import type nodemailer from "nodemailer"
import { signEmailToken } from "@/lib/email-tokens"
import {
  enqueueEmails,
  isRateLimitError,
  HOUR_MS,
  type OutboxMail,
} from "@/lib/email-outbox"

// Build a recipient's personalized, signed unsubscribe URL.
export function unsubscribeUrl(
  appUrl: string,
  email: string,
  authorId: string
): string {
  const token = signEmailToken("unsubscribe", email, authorId)
  return `${appUrl}/api/newsletter/unsubscribe?e=${encodeURIComponent(email)}&a=${authorId}&t=${token}`
}

// Send one personalized email per recipient, each with its own working
// unsubscribe link + RFC 8058 one-click headers (CAN-SPAM / Gmail+Yahoo
// bulk-sender rules require a per-recipient opt-out — BCC can't personalize the
// link). Bounded concurrency so a large audience doesn't open hundreds of SMTP
// connections at once. A single failure is queued in email_outbox for retry; a
// rate-limit (daily cap) stops the batch and queues everyone left for +1h.
// ponytail: still bounded by the serverless function timeout for very large
// lists — move to a queue/worker when an author's audience gets big.
export async function sendBulkDispatch(opts: {
  transporter: nodemailer.Transporter
  from: string
  subject: string
  recipients: string[]
  authorId: string
  appUrl: string
  /** Render the email HTML for one recipient, given their unsubscribe URL. */
  html: (unsubUrl: string) => string
  concurrency?: number
  /** Outbox DB (service role); defaults to a fresh service-role client. */
  db?: Parameters<typeof enqueueEmails>[2]
}): Promise<{
  sent: number
  queued: number
  /** Failed sends that could not be queued either (outbox insert failed). */
  lost: number
  lastInfo: nodemailer.SentMessageInfo | null
}> {
  const { transporter, from, subject, recipients, authorId, appUrl, html } = opts
  const concurrency = opts.concurrency ?? 8
  let i = 0
  let sent = 0
  let limited = false
  let lastInfo: nodemailer.SentMessageInfo | null = null
  const retryNow: OutboxMail[] = []
  const retryLater: OutboxMail[] = []

  const render = (email: string): OutboxMail => {
    const url = unsubscribeUrl(appUrl, email, authorId)
    return {
      to_email: email,
      from_email: from,
      subject,
      html: html(url),
      headers: {
        "List-Unsubscribe": `<${url}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }
  }

  async function worker() {
    while (!limited && i < recipients.length) {
      const mail = render(recipients[i++])
      try {
        lastInfo = await transporter.sendMail({
          from,
          to: mail.to_email,
          subject,
          html: mail.html,
          headers: mail.headers,
        })
        sent++
      } catch (e) {
        if (isRateLimitError(e)) {
          limited = true
          retryLater.push(mail)
        } else {
          console.error("[bulk-email] send failed, queued for retry:", e)
          retryNow.push(mail)
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, recipients.length) }, worker)
  )
  retryLater.push(...recipients.slice(i).map(render))
  // Only count what actually reached the outbox; anything else is lost and the
  // caller must say so rather than promise a later send.
  let queued = 0
  let lost = 0
  for (const [batch, delay] of [[retryNow, 0], [retryLater, HOUR_MS]] as const) {
    if (!batch.length) continue
    if (await enqueueEmails(batch, delay, opts.db)) queued += batch.length
    else lost += batch.length
  }
  return { sent, queued, lost, lastInfo }
}

import { CONTACT_EMAIL } from "@/lib/brand"
import nodemailer from "nodemailer"
import { sendBulkDispatch } from "@/lib/newsletter-send"
import { queueIfRateLimited } from "@/lib/email-outbox"
import { escapeHtml as esc, fromName, nibButton, nibLayout, type NibLayoutOptions } from "@/lib/email-layout"

// Lazily initialized transporter: real SMTP when SMTP_HOST is set,
// Ethereal test account in dev, null in production (callers skip + warn).
let transporter: nodemailer.Transporter | null = null

export async function getTransporter() {
  if (transporter) return transporter

  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT ?? 587)
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
    return transporter
  }

  if (process.env.NODE_ENV === "production") return null

  const testAccount = await nodemailer.createTestAccount()
  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  })

  return transporter
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
const EMAIL_FROM = process.env.EMAIL_FROM ?? CONTACT_EMAIL

/**
 * Generic one-off transactional send (payout notices, restriction notices,
 * etc.). Consolidates what used to live in lib/email/mailer.ts so there is a
 * single transporter + recipient path.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  from?: string,
  layout: NibLayoutOptions = {}
) {
  html = nibLayout(html, { preview: subject, ...layout })
  try {
    const t = await getTransporter()
    if (!t) {
      console.warn("[email] SMTP_HOST not set; skipping send")
      return { ok: false, error: "smtp_not_configured" }
    }
    const info = await t.sendMail({
      from: from ?? `"Nib" <${EMAIL_FROM}>`,
      to,
      subject,
      html,
    })
    console.log("Message sent: %s", info.messageId)
    return { ok: true, messageId: info.messageId }
  } catch (error) {
    const mail = { to_email: to, from_email: from ?? `"Nib" <${EMAIL_FROM}>`, subject, html }
    if (await queueIfRateLimited(error, mail)) return { ok: true, queued: true }
    console.error("Error sending email:", error)
    return { ok: false, error }
  }
}

/**
 * Notifies an author's audience when a new piece is published. One personalized
 * email per recipient so each carries a working unsubscribe link + one-click
 * headers (bulk-mail compliance). recipientEmails must already be the compliant
 * list from getAuthorRecipientEmails (confirmed + unsuppressed).
 */
export async function sendPublishEmail({
  authorName,
  authorHandle,
  authorId,
  pieceTitle,
  pieceSummary,
  pieceSlug,
  recipientEmails,
}: {
  authorName: string
  authorHandle: string
  authorId: string
  pieceTitle: string
  pieceSummary: string
  pieceSlug: string
  recipientEmails: string[]
}) {
  if (!recipientEmails || recipientEmails.length === 0) return

  const pieceUrl = `${APP_URL}/u/${authorHandle}/${pieceSlug}`
  const UNSUB = "__NIB_UNSUB__"
  const body = nibLayout(
    `<h1>${esc(pieceTitle)}</h1>` +
      `<p>${esc(pieceSummary || "A new piece has been published.")}</p>` +
      nibButton("Read the full piece", pieceUrl),
    {
      preview: `${authorName} published: ${pieceTitle}`,
      eyebrow: `New from ${authorName}`,
      footer: `You received this because you follow @${authorHandle} on Nib.`,
      unsubscribeUrl: UNSUB,
    }
  )

  try {
    const t = await getTransporter()
    if (!t) {
      console.warn("[email] SMTP_HOST not set; skipping publish emails")
      return
    }
    const { sent, queued, lost } = await sendBulkDispatch({
      transporter: t,
      from: `"${fromName(authorName)} on Nib" <${EMAIL_FROM}>`,
      subject: `New piece: ${pieceTitle}`,
      recipients: recipientEmails,
      authorId,
      appUrl: APP_URL,
      html: (unsubUrl) => body.split(UNSUB).join(unsubUrl),
    })
    console.log("[Email API] publish emails sent: %d, queued: %d", sent, queued)
    if (lost) console.error("[Email API] %d publish emails could not be sent or queued", lost)
  } catch (error) {
    console.error("[Email API] Failed to send publish email", error)
  }
}

/**
 * Sends an email notification to a user when they subscribe/follow an author.
 */
export async function sendSubscriptionEmail({
  authorName,
  authorHandle,
  recipientEmail,
}: {
  authorName: string
  authorHandle: string
  recipientEmail: string
}) {
  if (!recipientEmail) return

  const authorUrl = `${APP_URL}/u/${authorHandle}`
  const mail = {
      from: `"${fromName(authorName)} on Nib" <${EMAIL_FROM}>`,
      to: recipientEmail,
      subject: `You are now subscribed to ${authorName}`,
      text: `Hi there,\n\nYou have successfully subscribed to ${authorName} (@${authorHandle}). You will now receive their latest pieces directly in your inbox.\n\nVisit their studio: ${authorUrl}`,
      html: nibLayout(
        `<h1>You're subscribed</h1>` +
          `<p>You'll now get new pieces from <strong>${esc(authorName)}</strong> (@${esc(authorHandle)}) in your inbox.</p>` +
          nibButton(`Visit ${authorName} on Nib`, authorUrl),
        { preview: `You are now subscribed to ${authorName}`, eyebrow: "Subscription", tone: "success", footer: `You followed @${authorHandle} on Nib.` }
      ),
  }

  try {
    const t = await getTransporter()
    if (!t) {
      console.warn("[email] SMTP_HOST not set; skipping subscription email")
      return
    }
    const info = await t.sendMail(mail)
    console.log("Subscription email sent: %s", info.messageId)
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info))
  } catch (error) {
    const queued = await queueIfRateLimited(error, {
      to_email: mail.to,
      from_email: mail.from,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    })
    if (queued) return
    console.error("[Email API] Failed to send subscription email", error)
  }
}

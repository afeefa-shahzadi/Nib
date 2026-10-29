import type nodemailer from "nodemailer"

// Durable queue for mail we couldn't send right now (SMTP daily limit hit,
// transient failure). Drained hourly by /api/cron/email-outbox. Service role only.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = { from(table: string): any }

export type OutboxMail = {
  to_email: string
  from_email: string
  subject: string
  html: string
  text?: string
  headers?: Record<string, string>
}

export const HOUR_MS = 60 * 60 * 1000
export const MAX_ATTEMPTS = 72

const later = (ms: number) => new Date(Date.now() + ms).toISOString()

/** SMTP "you've sent too much" — retrying now is pointless, wait for the reset. */
export function isRateLimitError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false
  const err = e as { responseCode?: number; response?: string; message?: string }
  const text = `${err.response ?? ""} ${err.message ?? ""}`
  if (/\b5\.4\.5\b/.test(text)) return true // Gmail daily sending limit
  if (![421, 450, 451, 452, 454, 550].includes(err.responseCode ?? 0)) return false
  return /limit|quota|rate|too many|\b4\.7\.0\b/i.test(text)
}

async function serviceDb(): Promise<Db> {
  const { createServiceRoleClient } = await import("@/lib/supabase/server")
  return createServiceRoleClient()
}

/** Queue mail. Returns true when stored; logs (doesn't throw) on DB failure. */
export async function enqueueEmails(
  rows: OutboxMail[],
  delayMs = 0,
  db?: Db
): Promise<boolean> {
  if (!rows.length) return true
  const client = db ?? (await serviceDb())
  const send_after = later(delayMs)
  const { error } = await client
    .from("email_outbox")
    .insert(rows.map((r) => ({ ...r, headers: r.headers ?? {}, send_after })))
  if (error) {
    console.error(`[email-outbox] failed to queue ${rows.length} emails:`, error)
    return false
  }
  return true
}

/** Single transactional send failed: queue it for +1h if it was the SMTP limit. */
export async function queueIfRateLimited(e: unknown, mail: OutboxMail): Promise<boolean> {
  if (!isRateLimitError(e)) return false
  return enqueueEmails([mail], HOUR_MS)
}

type OutboxRow = OutboxMail & { id: string; attempts: number }

/**
 * Send due rows oldest first. Rows are leased atomically by claim_email_outbox
 * (send_after pushed +15 min, FOR UPDATE SKIP LOCKED), so overlapping drains
 * never pick the same row. Delivery is at-least-once: if marking sent_at fails
 * after a successful send, the lease expires and the row is resent once.
 * A rate limit stops the run and defers the rest +1h without using an attempt;
 * only real errors count toward MAX_ATTEMPTS.
 */
export async function drainOutbox(
  db: Db & { rpc(fn: string, args?: object): any },
  transporter: Pick<nodemailer.Transporter, "sendMail">,
  limit = 400
) {
  const { error: pruneError } = await db
    .from("email_outbox")
    .delete()
    .lt("sent_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
  if (pruneError) console.error("[email-outbox] prune failed:", pruneError)

  const { data, error } = await db.rpc("claim_email_outbox", { n: limit })
  if (error) throw error
  const rows = (data ?? []) as OutboxRow[]

  let sent = 0
  let failed = 0
  for (let k = 0; k < rows.length; k++) {
    const r = rows[k]
    try {
      await transporter.sendMail({
        from: r.from_email,
        to: r.to_email,
        subject: r.subject,
        html: r.html,
        text: r.text ?? undefined,
        headers: r.headers ?? {},
      })
    } catch (e) {
      if (isRateLimitError(e)) {
        const ids = rows.slice(k).map((x) => x.id)
        const { error: deferError } = await db.rpc("defer_email_outbox", { ids })
        // Lease still expires in 15 min, so a failed defer only means an early retry.
        if (deferError) console.error("[email-outbox] defer failed:", deferError)
        return { sent, failed, rescheduled: ids.length }
      }
      failed++
      const attempts = r.attempts + 1
      const last_error =
        attempts >= MAX_ATTEMPTS ? "gave up" : String((e as Error)?.message ?? e).slice(0, 500)
      await db
        .from("email_outbox")
        .update({ attempts, last_error, send_after: later(HOUR_MS) })
        .eq("id", r.id)
      continue
    }
    sent++
    const { error: markError } = await db
      .from("email_outbox")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", r.id)
    if (markError)
      console.error(`[email-outbox] SENT but could not mark row ${r.id}; it will be resent once:`, markError)
  }
  return { sent, failed, rescheduled: 0 }
}

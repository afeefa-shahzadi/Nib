import { nibButton } from "@/lib/email-layout"
import type { SupabaseClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/email"

// Creator strike & reputation gate. See
// docs/superpowers/specs/2026-07-18-creator-strike-gate-design.md
//
// Strikes are cumulative and only ever increase (applied on admin-confirmed
// takedown). The ladder: the first WARN_LIMIT strikes are warnings with no
// account freeze — the offending piece is already unpublished by the takedown,
// and because the account isn't restricted the creator can revise + republish.
// Past that, a temporary publish/payout freeze escalates to a permanent ban.
//
// ponytail: policy is these three constants. A stricter/looser ladder is a
// one-line edit here, not a config table.
export const WARN_LIMIT = 3
const FREEZE_7D_DAYS = 7
const FREEZE_30D_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

// Pure. Returns the DB value for restricted_until at strike `n`:
//   null       -> no account freeze (warning tier, or top of ladder cleared)
//   ISO string -> temporary freeze until then
//   'infinity' -> permanent ban (Postgres timestamptz literal)
// `now` is injectable so the ladder is testable without a clock.
export function restrictionForStrike(
  n: number,
  now: Date = new Date()
): { until: string | null } {
  if (n <= WARN_LIMIT) return { until: null }
  if (n === WARN_LIMIT + 1)
    return { until: new Date(now.getTime() + FREEZE_7D_DAYS * DAY_MS).toISOString() }
  if (n === WARN_LIMIT + 2)
    return { until: new Date(now.getTime() + FREEZE_30D_DAYS * DAY_MS).toISOString() }
  return { until: "infinity" }
}

export type Restriction = {
  restricted: boolean
  permanent: boolean
  until: Date | null // null when not restricted OR permanent (see `permanent`)
  reason: string | null
}

// Reads the caller's own penalty state. 'infinity' can't go through `new Date`
// (it yields Invalid Date), so permanent bans are matched on the literal first.
export async function getRestriction(
  supabase: SupabaseClient,
  userId: string
): Promise<Restriction> {
  const { data } = await supabase
    .from("profiles")
    .select("restricted_until, restricted_reason")
    .eq("id", userId)
    .maybeSingle()

  const raw = (data as { restricted_until?: string | null })?.restricted_until ?? null
  const reason = (data as { restricted_reason?: string | null })?.restricted_reason ?? null
  if (!raw) return { restricted: false, permanent: false, until: null, reason: null }
  if (raw === "infinity") return { restricted: true, permanent: true, until: null, reason }

  const until = new Date(raw)
  const restricted = until.getTime() > Date.now()
  return { restricted, permanent: false, until, reason: restricted ? reason : null }
}

// Throws a user-facing error if the caller is currently restricted. `kind`
// only changes the noun in the message; the gate is identical for both.
export async function assertNotRestricted(
  supabase: SupabaseClient,
  userId: string,
  kind: "publish" | "payout"
): Promise<void> {
  const r = await getRestriction(supabase, userId)
  if (!r.restricted) return
  const noun = kind === "payout" ? "Payouts" : "Publishing"
  if (r.permanent)
    throw new Error("Your account is restricted. You can appeal from Studio.")
  const when = r.until!.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  throw new Error(
    `${noun} restricted until ${when} — a piece was removed for a policy violation. You can appeal from Studio.`
  )
}

// Applies one strike to `authorId` and escalates per the ladder. Called from
// takedownContent (the only confirmed-violation site). Idempotency lives at the
// call site (the gated report resolve), not here — this always increments.
export async function applyStrike(
  admin: SupabaseClient,
  opts: {
    authorId: string
    moderatorId: string
    contentObjectId?: string | null
    reportId?: string | null
    reason?: string | null
  }
): Promise<{ strikes: number; until: string | null }> {
  const { authorId, moderatorId, contentObjectId, reportId, reason } = opts

  const { data: prof } = await admin
    .from("profiles")
    .select("strikes")
    .eq("id", authorId)
    .maybeSingle()
  const next = ((prof as { strikes?: number })?.strikes ?? 0) + 1
  const { until } = restrictionForStrike(next)
  const restricted_reason = reason?.trim() || "Content removed for a policy violation."

  await admin
    .from("profiles")
    .update({ strikes: next, restricted_until: until, restricted_reason })
    .eq("id", authorId)

  await admin.from("moderation_actions").insert({
    moderator_id: moderatorId,
    content_object_id: contentObjectId ?? null,
    report_id: reportId ?? null,
    action: "strike",
    reason: until
      ? `strike ${next} — publishing restricted (${until})`
      : `strike ${next} — warning`,
  })

  // Best-effort notification. Never let a mail failure roll back the strike.
  try {
    const { data: u } = await admin.auth.admin.getUserById(authorId)
    const email = u?.user?.email
    if (email) {
      const studio = `${(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/studio`
      const [subject, html] = until
        ? [
            "Your Nib account has been restricted",
            `<h1>Your account is restricted</h1><p>A piece was removed for a policy violation. Publishing and payouts are paused${
              until === "infinity" ? "" : ` until <strong>${new Date(until).toDateString()}</strong>`
            }.</p><p>If you think this was a mistake, you can appeal from your Studio. We review every appeal.</p>${nibButton("Open Studio to appeal", studio, "warning")}`,
          ]
        : [
            "A piece was removed — warning",
            `<h1>A piece was removed</h1><p>One of your pieces was removed for a policy violation.</p><div class="nib-note">Warning <strong>${next} of ${WARN_LIMIT}</strong>. Repeated violations lead to a publishing restriction.</div><p style="margin-top:16px">You can revise the piece and publish it again.</p>${nibButton("Go to Studio", studio)}`,
          ]
      await sendEmail(email, subject, html, undefined, {
        eyebrow: until ? "Account restricted" : "Policy warning",
        tone: "warning",
      })
    }
  } catch (e) {
    console.error("[server] strike notify failed (non-blocking):", e)
  }

  return { strikes: next, until }
}

// Clears a restriction (appeal accepted / manual lift). Resets strikes so the
// creator starts clean. Writes an audit row.
export async function clearRestriction(
  admin: SupabaseClient,
  userId: string,
  moderatorId: string
): Promise<void> {
  await admin
    .from("profiles")
    .update({ restricted_until: null, restricted_reason: null, strikes: 0 })
    .eq("id", userId)
  await admin.from("moderation_actions").insert({
    moderator_id: moderatorId,
    action: "restriction_lifted",
    reason: "restriction lifted",
  })
}

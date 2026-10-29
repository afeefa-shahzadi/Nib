"use server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { signEmailToken } from "@/lib/email-tokens"
import { sendEmail } from "@/lib/email"
import { escapeHtml, nibButton } from "@/lib/email-layout"

export async function subscribeToAuthor(args: { author_id: string; email: string }) {
  const supabase = await createClient()
  const { data: _auth } = await supabase.auth.getUser()

  const email = args.email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." }
  }

  const user = _auth?.user
  // A signed-in user subscribing with their own verified account email has
  // already proven ownership — no need to double opt-in. A raw guest email must
  // confirm. Insert via the service role so this server-decided confirmed_at
  // survives the BEFORE INSERT trigger that forces everyone else to pending.
  const selfConfirmed = !!user?.email && user.email.toLowerCase() === email
  const svc = await createServiceRoleClient()

  const { error } = await svc.from("author_subscribers").insert({
    author_id: args.author_id,
    subscriber_email: email,
    subscriber_id: user?.id ?? null,
    confirmed_at: selfConfirmed ? new Date().toISOString() : null,
  })

  if (error) {
    if (error.code === "23505") {
      return { ok: true, message: "You're already subscribed." }
    }
    console.error("[subscribeToAuthor] Error:", error)
    return { ok: false, error: "Failed to subscribe. Please try again." }
  }

  if (selfConfirmed) {
    return { ok: true, message: "Subscribed." }
  }

  // Double opt-in: email a confirm link before this address receives anything.
  try {
    const { data: author } = await svc
      .from("profiles")
      .select("display_name, handle")
      .eq("id", args.author_id)
      .maybeSingle()
    const name = author?.display_name || author?.handle || "this author"
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    const token = signEmailToken("confirm", email, args.author_id)
    const confirmUrl = `${appUrl}/api/newsletter/confirm?e=${encodeURIComponent(email)}&a=${args.author_id}&t=${token}`
    await sendEmail(
      email,
      `Confirm your subscription to ${name}`,
      `<h1>Confirm your subscription</h1><p>Tap below to confirm you'd like new pieces from <strong>${escapeHtml(name)}</strong> by email.</p>` +
        nibButton("Confirm subscription", confirmUrl) +
        `<p class="nib-muted">If you didn't request this, ignore this email. Nothing will be sent.</p>`,
      undefined,
      { eyebrow: "One more step" }
    )
  } catch (e) {
    console.error("[subscribeToAuthor] confirm email failed:", e)
  }

  return { ok: true, message: "Check your email to confirm your subscription." }
}

export async function markNewsletterModalSeen() {
  const supabase = await createClient()
  const { data: _auth } = await supabase.auth.getUser()
  if (!_auth?.user) return { ok: false }

  await supabase
    .from("user_stats")
    .update({ has_seen_newsletter_modal: true })
    .eq("user_id", _auth.user.id)

  return { ok: true }
}

export async function getNewsletterModalSeen() {
  const supabase = await createClient()
  const { data: _auth } = await supabase.auth.getUser()
  if (!_auth?.user) return false

  const { data: stats } = await supabase
    .from("user_stats")
    .select("has_seen_newsletter_modal")
    .eq("user_id", _auth.user.id)
    .maybeSingle()

  return stats?.has_seen_newsletter_modal ?? false
}

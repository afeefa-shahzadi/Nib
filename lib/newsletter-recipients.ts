import { SupabaseClient } from "@supabase/supabase-js"

// Every email that should receive an author's dispatch: registered followers
// (emails resolved via the auth admin API) plus CONFIRMED guest email
// subscribers, deduped, minus anyone on the suppression (unsubscribe) list.
// Requires a service-role client — it uses auth.admin.listUsers and reads the
// RLS-locked email_unsubscribes table.
export async function getAuthorRecipientEmails(
  supabaseAdmin: SupabaseClient,
  authorId: string
): Promise<string[]> {
  const emails = new Set<string>()

  const { data: follows } = await supabaseAdmin
    .from("follows")
    .select("follower_id")
    .eq("author_id", authorId)
  const followerIds = new Set(
    (follows ?? []).map((f: { follower_id: string }) => f.follower_id)
  )

  if (followerIds.size > 0) {
    // Follower emails live in auth.users (there is no profiles.email column), so
    // page through listUsers until a short page signals the end — the old single
    // perPage:1000 call silently dropped followers past the first 1000.
    // ponytail: O(all users) per dispatch. Fine at launch scale; if the user
    // table gets large, backfill a profiles.email column via an auth trigger and
    // query it directly instead of scanning every user.
    const perPage = 1000
    for (let page = 1; page <= 1000; page++) {
      const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      const users = data?.users ?? []
      for (const u of users) {
        if (u.email && followerIds.has(u.id)) emails.add(u.email)
      }
      if (users.length < perPage) break
    }
  }

  // Guest email subscribers — only those who confirmed (double opt-in). Pending
  // (confirmed_at NULL) rows never receive mail.
  const { data: subs } = await supabaseAdmin
    .from("author_subscribers")
    .select("subscriber_email")
    .eq("author_id", authorId)
    .not("confirmed_at", "is", null)
  for (const s of subs ?? []) {
    if (s.subscriber_email) emails.add(s.subscriber_email)
  }

  if (emails.size === 0) return []

  // Drop anyone who unsubscribed from this author or from all Nib mail.
  const { data: suppressed } = await supabaseAdmin
    .from("email_unsubscribes")
    .select("email, author_id")
    .in("email", [...emails])
  for (const row of suppressed ?? []) {
    if (row.author_id === null || row.author_id === authorId) {
      emails.delete(row.email as string)
    }
  }

  return [...emails]
}

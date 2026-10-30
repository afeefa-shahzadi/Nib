import type { SupabaseClient } from "@supabase/supabase-js"

// Tiptap's mention node: <span data-type="mention" ... data-id="handle" ...>@handle</span>
const MENTION = /<span\b[^>]*data-type="mention"[^>]*data-id="([^"]+)"[^>]*>[\s\S]*?<\/span>/g

// Replace the mention links for these handles with plain "@handle" text.
export function unlinkMentions(html: string, blocked: Set<string>) {
  return html.replace(MENTION, (whole, handle: string) =>
    blocked.has(handle) ? `@${handle}` : whole
  )
}

// Apply each mentioned person's "who can mention you" setting before a reply
// is saved: "everyone", "following" (only people they follow), or "none".
export async function enforceMentionPolicy(
  admin: SupabaseClient,
  html: string,
  authorId: string
) {
  const handles = [...new Set([...html.matchAll(MENTION)].map((m) => m[1]))]
  if (!handles.length) return html
  const { data: people } = await admin
    .from("profiles")
    .select("id, handle, mention_policy")
    .in("handle", handles)
  const others = (people ?? []).filter((p) => p.id !== authorId)
  const picky = others.filter((p) => p.mention_policy === "following")
  const { data: follows } = picky.length
    ? await admin
        .from("follows")
        .select("follower_id")
        .eq("author_id", authorId)
        .in("follower_id", picky.map((p) => p.id))
    : { data: [] }
  const followsMe = new Set((follows ?? []).map((f) => f.follower_id as string))
  const blocked = new Set(
    others
      .filter(
        (p) =>
          p.mention_policy === "none" ||
          (p.mention_policy === "following" && !followsMe.has(p.id))
      )
      .map((p) => p.handle as string)
  )
  return blocked.size ? unlinkMentions(html, blocked) : html
}

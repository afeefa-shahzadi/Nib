import type { SupabaseClient } from "@supabase/supabase-js"

// Notifications that point at a spot in a piece: someone mentioned you, replied
// to your response, or responded to your piece. payload.url deep-links there.
export const ACTIVITY_VERB: Record<string, string> = {
  mention: "mentioned you in",
  reply: "replied to you on",
  response: "responded to",
}

const MENTION_ID = /<span\b[^>]*data-type="mention"[^>]*data-id="([^"]+)"/g

export function excerptOf(html: string, max = 140) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text
}

// Never throws: a failed notification must not fail the post that caused it.
// ponytail: one row per event, no "Ann and 4 others" grouping; add when claps notify.
export async function notifyActivity(
  admin: SupabaseClient,
  opts: {
    actorId: string
    pieceId: string
    html: string // saved body, after mention policy, so blocked mentions are plain text
    anchor: string // "?response=<id>" or "#room-<id>"
    replyToUserId?: string | null
    notifyPieceAuthor?: boolean
  }
) {
  try {
    const { data: piece } = await admin
      .from("content_objects")
      .select("title, slug, author_id, author:profiles!author_id(handle)")
      .eq("id", opts.pieceId)
      .maybeSingle()
    if (!piece) return
    const handles = [...new Set([...opts.html.matchAll(MENTION_ID)].map((m) => m[1]))]
    const { data: mentioned } = handles.length
      ? await admin.from("profiles").select("id").in("handle", handles)
      : { data: [] }

    // One notification per person; a mention outranks a reply, a reply outranks a response.
    const to = new Map<string, string>()
    for (const p of mentioned ?? []) to.set(p.id as string, "mention")
    if (opts.replyToUserId && !to.has(opts.replyToUserId)) to.set(opts.replyToUserId, "reply")
    if (opts.notifyPieceAuthor && !to.has(piece.author_id)) to.set(piece.author_id, "response")
    to.delete(opts.actorId)
    if (!to.size) return

    const author = (Array.isArray(piece.author) ? piece.author[0] : piece.author) as { handle?: string } | null
    const payload = {
      sender_id: opts.actorId,
      piece_id: opts.pieceId,
      title: piece.title,
      url: `/u/${author?.handle ?? "_"}/${piece.slug}${opts.anchor}`,
      excerpt: excerptOf(opts.html),
    }
    const { error } = await admin
      .from("notifications")
      .insert([...to].map(([user_id, type]) => ({ user_id, type, payload })))
    if (error) console.error("[notify]", error)
  } catch (e) {
    console.error("[notify]", e)
  }
}

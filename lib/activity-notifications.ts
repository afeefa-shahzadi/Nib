import type { SupabaseClient } from "@supabase/supabase-js"

// Notifications that point at a spot in a piece: someone mentioned you, replied
// to your response, responded to or clapped for your piece. payload.url deep-links there.
export const ACTIVITY_VERB: Record<string, string> = {
  mention: "mentioned you in",
  reply: "replied to you on",
  response: "responded to",
  clap: "clapped for",
}

// Types a person can turn off in Settings > Notifications.
export const NOTIFICATION_TYPES = [
  { type: "mention", label: "Mentions", help: "Someone @mentions you in a piece, response or debate." },
  { type: "reply", label: "Replies", help: "Someone replies to your response." },
  { type: "response", label: "Responses", help: "Someone responds to your piece." },
  { type: "clap", label: "Claps", help: "Readers clap for your piece, grouped per piece." },
  { type: "new_follower", label: "New followers", help: "Someone follows you." },
  { type: "new_piece", label: "New pieces", help: "A writer you follow publishes." },
] as const
export const MUTABLE_TYPES: readonly string[] = NOTIFICATION_TYPES.map((t) => t.type)

// <a|span data-type="mention" data-id="..."> — pieces store the user id, responses the handle.
const MENTION_TAG = /<(?:a|span)\b[^>]*data-type="mention"[^>]*>/g
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function mentionRefs(html: string) {
  const refs = new Set<string>()
  for (const [tag] of html.matchAll(MENTION_TAG)) {
    const id = tag.match(/data-id="([^"]+)"/)?.[1]
    if (id) refs.add(id)
  }
  return [...refs]
}

async function mentionedIds(admin: SupabaseClient, html: string) {
  const refs = mentionRefs(html)
  const ids = refs.filter((r) => UUID.test(r))
  const handles = refs.filter((r) => !UUID.test(r))
  const { data } = handles.length ? await admin.from("profiles").select("id").in("handle", handles) : { data: [] }
  return [...new Set([...ids, ...(data ?? []).map((p) => p.id as string)])]
}

export function excerptOf(html: string, max = 140) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text
}

type Row = { user_id: string; type: string; payload: Record<string, unknown> }

// Every system notification goes through here so Settings > Notifications applies.
export async function insertNotifications(admin: SupabaseClient, rows: Row[]) {
  if (!rows.length) return
  const { data: muted } = await admin
    .from("profiles")
    .select("id, muted_notifications")
    .in("id", [...new Set(rows.map((r) => r.user_id))])
  const off = new Map((muted ?? []).map((p) => [p.id as string, new Set((p.muted_notifications as string[]) ?? [])]))
  const keep = rows.filter((r) => !off.get(r.user_id)?.has(r.type))
  if (!keep.length) return
  const { error } = await admin.from("notifications").insert(keep)
  if (error) console.error("[notify]", error)
}

async function loadPiece(admin: SupabaseClient, pieceId: string) {
  const { data } = await admin
    .from("content_objects")
    .select("title, slug, author_id, author:profiles!author_id(handle)")
    .eq("id", pieceId)
    .maybeSingle()
  if (!data) return null
  const author = (Array.isArray(data.author) ? data.author[0] : data.author) as { handle?: string } | null
  return { ...data, url: `/u/${author?.handle ?? "_"}/${data.slug}` }
}

// Never throws: a failed notification must not fail the post that caused it.
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
    const piece = await loadPiece(admin, opts.pieceId)
    if (!piece) return
    // One notification per person; a mention outranks a reply, a reply outranks a response.
    const to = new Map<string, string>()
    for (const id of await mentionedIds(admin, opts.html)) to.set(id, "mention")
    if (opts.replyToUserId && !to.has(opts.replyToUserId)) to.set(opts.replyToUserId, "reply")
    if (opts.notifyPieceAuthor && !to.has(piece.author_id)) to.set(piece.author_id, "response")
    to.delete(opts.actorId)
    const payload = {
      sender_id: opts.actorId,
      piece_id: opts.pieceId,
      title: piece.title,
      url: piece.url + opts.anchor,
      excerpt: excerptOf(opts.html),
    }
    await insertNotifications(admin, [...to].map(([user_id, type]) => ({ user_id, type, payload })))
  } catch (e) {
    console.error("[notify]", e)
  }
}

// People @mentioned in a published piece's text. Each person is told once per
// piece, so re-saving or editing only reaches newly added mentions.
export async function notifyPieceMentions(admin: SupabaseClient, pieceId: string) {
  try {
    const piece = await loadPiece(admin, pieceId)
    if (!piece) return
    const { data: blocks } = await admin
      .from("blocks")
      .select("id, content")
      .eq("content_object_id", pieceId)
      .order("order", { ascending: true })
    const first = new Map<string, { blockId: string; html: string }>() // person -> first block mentioning them
    for (const b of (blocks ?? []) as { id: string; content: Record<string, unknown> | null }[]) {
      const html = typeof b.content?.html === "string" ? b.content.html : ""
      if (!html.includes("mention")) continue
      for (const id of await mentionedIds(admin, html)) if (!first.has(id)) first.set(id, { blockId: b.id, html })
    }
    first.delete(piece.author_id)
    if (!first.size) return
    const { data: told } = await admin
      .from("notifications")
      .select("user_id")
      .eq("type", "mention")
      .eq("payload->>piece_id", pieceId)
      .eq("payload->>source", "piece")
      .in("user_id", [...first.keys()])
    for (const t of told ?? []) first.delete(t.user_id as string)
    await insertNotifications(
      admin,
      [...first].map(([user_id, { blockId, html }]) => ({
        user_id,
        type: "mention",
        payload: {
          sender_id: piece.author_id,
          piece_id: pieceId,
          source: "piece",
          title: piece.title,
          url: `${piece.url}#block-${blockId}`,
          excerpt: excerptOf(html),
        },
      }))
    )
  } catch (e) {
    console.error("[notify]", e)
  }
}

// Claps group into one unread notification per piece: "Ann and 4 others clapped".
// Each reader counts once per piece, however many times they clap.
export async function notifyClap(admin: SupabaseClient, pieceId: string, clapperId: string) {
  try {
    const piece = await loadPiece(admin, pieceId)
    if (!piece || piece.author_id === clapperId) return
    const { data: seen } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", piece.author_id)
      .eq("type", "clap")
      .eq("payload->>piece_id", pieceId)
      .contains("payload", { sender_ids: [clapperId] })
      .limit(1)
    if (seen?.length) return
    const { data: open } = await admin
      .from("notifications")
      .select("id, payload")
      .eq("user_id", piece.author_id)
      .eq("type", "clap")
      .eq("payload->>piece_id", pieceId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (open) {
      const prev = (open.payload ?? {}) as { sender_ids?: string[]; count?: number }
      // ponytail: read-modify-write; two claps in the same instant can lose one name from the count.
      await admin
        .from("notifications")
        .update({
          created_at: new Date().toISOString(),
          payload: {
            ...prev,
            sender_id: clapperId,
            sender_ids: [clapperId, ...(prev.sender_ids ?? [])].slice(0, 200),
            count: (prev.count ?? 1) + 1,
          },
        })
        .eq("id", open.id)
      return
    }
    await insertNotifications(admin, [
      {
        user_id: piece.author_id,
        type: "clap",
        payload: { sender_id: clapperId, sender_ids: [clapperId], count: 1, piece_id: pieceId, title: piece.title, url: piece.url },
      },
    ])
  } catch (e) {
    console.error("[notify]", e)
  }
}

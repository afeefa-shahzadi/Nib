/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { assertCanPost } from "@/lib/parental-consent"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import DOMPurify from "isomorphic-dompurify"
import { getViewablePiece } from "@/actions/content/helpers"
import { checkRateLimit } from "@/lib/rate-limit.server"
import { COMMENTS_PAGE } from "@/lib/comments"
import { notifyActivity } from "@/lib/activity-notifications"
import { enforceMentionPolicy } from "@/lib/mentions.server"

export async function listComments(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: authData } = await (await createClient()).auth.getUser()
  const viewerId = authData?.user?.id ?? null

  // Page 1: pinned plus the newest COMMENTS_PAGE. Older pages pass `before`
  // (the oldest unpinned created_at the client has) and skip pinned ones.
  const __handler = async ({ data }: { data: { piece_id: string; before?: string; focus?: string } }) => {
    if (data.before && Number.isNaN(Date.parse(data.before))) return []
    if (!(await getViewablePiece(supabaseAdmin, data.piece_id, viewerId))) return []
    let query = supabaseAdmin
      .from("piece_responses")
      .select("id, body, created_at, user_id, parent_id, sources, quoted_text, serialized_range, is_pinned")
      .eq("piece_id", data.piece_id)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(COMMENTS_PAGE)
    if (data.before) query = query.eq("is_pinned", false).lt("created_at", data.before)
    // A notification's response that isn't on the first page: fetch it and its parent.
    if (data.focus) {
      const { data: t } = await supabaseAdmin
        .from("piece_responses")
        .select("id, parent_id")
        .eq("id", data.focus)
        .eq("piece_id", data.piece_id)
        .maybeSingle()
      if (!t) return []
      query = supabaseAdmin
        .from("piece_responses")
        .select("id, body, created_at, user_id, parent_id, sources, quoted_text, serialized_range, is_pinned")
        .eq("piece_id", data.piece_id)
        .in("id", [t.id, t.parent_id].filter(Boolean))
    }
    const { data: rows, error } = await query

    if (error) {
      if (error.code !== "42P01") {
        console.error(error)
      }
      return []
    }

    if (!rows || rows.length === 0) return []
    // Fetched pinned + newest; show pinned first, then oldest first as before.
    rows.sort((a: any, b: any) => Number(b.is_pinned) - Number(a.is_pinned) || a.created_at.localeCompare(b.created_at))

    // Fetch profiles
    const userIds = [...new Set(rows.map((r: { user_id: string }) => r.user_id))]
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, handle, display_name")
      .in("id", userIds)

    const pMap = new Map(profiles?.map(p => [p.id, p]))

    // Fetch votes for all responses
    // Chunked: .in() ids go in the URL, and 300 uuids would overflow it.
    const responseIds = rows.map((r: { id: string }) => r.id)
    const chunks = []
    for (let i = 0; i < responseIds.length; i += 100) chunks.push(responseIds.slice(i, i + 100))
    const votes = (await Promise.all(chunks.map((ids) => supabaseAdmin
      .from("piece_response_votes")
      .select("response_id, user_id, vote_type")
      .in("response_id", ids)))).flatMap((r) => r.data ?? [])

    const votesMap = new Map<string, { upvotes: number; downvotes: number; user_vote: number }>()
    votes?.forEach((v: { response_id: string; user_id: string; vote_type: number }) => {
      if (!votesMap.has(v.response_id)) votesMap.set(v.response_id, { upvotes: 0, downvotes: 0, user_vote: 0 })
      const entry = votesMap.get(v.response_id)!
      if (v.vote_type === 1) entry.upvotes++
      else if (v.vote_type === -1) entry.downvotes++
      if (viewerId && v.user_id === viewerId) entry.user_vote = v.vote_type
    })

    // Votes are aggregated above; voter ids never leave the server.
    return rows.map((r: { user_id: string; id: string; [key: string]: any }) => ({
      ...r,
      author: pMap.get(r.user_id) || null,
      ...(votesMap.get(r.id) ?? { upvotes: 0, downvotes: 0, user_vote: 0 }),
    }))
  }
  return await __handler({ data: args?.data as { piece_id: string; before?: string; focus?: string } })
}

export async function postComment(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: authData } = await (await createClient()).auth.getUser()

  const __handler = async ({
    data,
    userId,
  }: {
    data: { piece_id: string; body: string; parent_id?: string; quoted_text?: string; serialized_range?: any }
    userId: string
  }) => {
    await assertCanPost(userId)
    if (!data.body?.trim()) throw new Error("Write something first.")
    if (data.body.length > 10_000) throw new Error("Keep responses under 10,000 characters.")
    if (data.quoted_text && data.quoted_text.length > 1_000) throw new Error("That quote is too long.")
    if (data.serialized_range && JSON.stringify(data.serialized_range).length > 4_000)
      throw new Error("That selection is too long.")
    if (!(await getViewablePiece(supabaseAdmin, data.piece_id, userId)))
      throw new Error("Piece not found")
    let replyToUserId: string | null = null
    if (data.parent_id) {
      const { data: parent } = await supabaseAdmin
        .from("piece_responses")
        .select("piece_id, user_id")
        .eq("id", data.parent_id)
        .maybeSingle()
      if (!parent || parent.piece_id !== data.piece_id)
        throw new Error("Reply target not found")
      replyToUserId = parent.user_id
    }
    const sanitizedBody = DOMPurify.sanitize(data.body, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["style", "iframe", "form", "object", "embed", "link", "meta", "script"],
      FORBID_ATTR: ["style", "srcdoc", "formaction"],
      ADD_ATTR: ["class", "target"],
    })

    const { data: newComment, error } = await supabaseAdmin.from("piece_responses").insert({
      piece_id: data.piece_id,
      user_id: userId,
      body: await enforceMentionPolicy(supabaseAdmin, sanitizedBody, userId),
      ...(data.parent_id ? { parent_id: data.parent_id } : {}),
      ...(data.quoted_text ? { quoted_text: data.quoted_text } : {}),
      ...(data.serialized_range ? { serialized_range: data.serialized_range } : {}),
    }).select(`
      *,
      author:profiles!user_id(handle, display_name, avatar_url)
    `).single()
    if (error) {
      console.error("[comments]", error)
      throw new Error("Couldn't post your response. Try again.")
    }
    await notifyActivity(supabaseAdmin, {
      actorId: userId,
      pieceId: data.piece_id,
      html: newComment.body,
      anchor: `?response=${newComment.id}`,
      replyToUserId,
      notifyPieceAuthor: !data.parent_id,
    })
    return { success: true, data: newComment }
  }

  if (!authData?.user) throw new Error("Unauthorized")
  if (!(await checkRateLimit("comment", authData.user.id, 20, 600)).ok)
    throw new Error("You're commenting too fast. Try again in a few minutes.")

  return await __handler({
    data: args?.data as { piece_id: string; body: string; parent_id?: string; quoted_text?: string; serialized_range?: any },
    userId: authData.user.id
  })
}

export async function deleteComment(commentId: string) {
  const supabaseAdmin = await createAdminClient()
  const { data: authData } = await (await createClient()).auth.getUser()
  if (!authData?.user) throw new Error("Unauthorized")

  // Fetch comment to verify ownership. Resolve the piece author server-side —
  // never trust a client-supplied pieceAuthorId (caller could pass their own id).
  const { data: comment } = await supabaseAdmin
    .from("piece_responses")
    .select("user_id, piece_id")
    .eq("id", commentId)
    .single()

  if (!comment) throw new Error("Comment not found")

  const { data: piece } = await supabaseAdmin
    .from("content_objects")
    .select("author_id")
    .eq("id", comment.piece_id)
    .maybeSingle()

  const isCommentAuthor = comment.user_id === authData.user.id
  const isPieceAuthor = !!piece && piece.author_id === authData.user.id
  if (!isCommentAuthor && !isPieceAuthor) throw new Error("Unauthorized")

  const { error } = await supabaseAdmin
    .from("piece_responses")
    .delete()
    .eq("id", commentId)

  if (error) {
    console.error("[comments]", error)
    throw new Error("Couldn't delete that. Try again.")
  }
  return { success: true }
}

export async function toggleCommentVote(commentId: string, voteType: 1 | -1 | 0) {
  const supabaseAdmin = await createAdminClient()
  const { data: authData } = await (await createClient()).auth.getUser()
  if (!authData?.user) throw new Error("Unauthorized")
  const userId = authData.user.id
  if (![1, -1, 0].includes(voteType)) throw new Error("Invalid vote")
  // Same rules as claps: the response must exist on a piece you can see, and not be yours.
  const { data: target } = await supabaseAdmin
    .from("piece_responses")
    .select("user_id, piece_id")
    .eq("id", commentId)
    .maybeSingle()
  if (!target || !(await getViewablePiece(supabaseAdmin, target.piece_id, userId)))
    throw new Error("Response not found")
  if (target.user_id === userId) throw new Error("You can't vote on your own response.")
  if (!(await checkRateLimit("comment_vote", userId, 60, 600)).ok)
    throw new Error("You're voting a lot. Try again in a few minutes.")

  if (voteType === 0) {
    // Remove vote
    await supabaseAdmin
      .from("piece_response_votes")
      .delete()
      .eq("response_id", commentId)
      .eq("user_id", userId)
  } else {
    // Upsert vote
    const { error } = await supabaseAdmin
      .from("piece_response_votes")
      .upsert({ response_id: commentId, user_id: userId, vote_type: voteType }, { onConflict: "response_id,user_id" })
    if (error) {
      console.error("[comments]", error)
      throw new Error("Couldn't save your vote.")
    }
  }
  return { success: true }
}

export async function togglePinComment(commentId: string, isPinned: boolean) {
  const supabaseAdmin = await createAdminClient()
  const { data: authData } = await (await createClient()).auth.getUser()
  if (!authData?.user) throw new Error("Unauthorized")

  // Pinning is a moderation action reserved for the piece's author.
  const { data: comment } = await supabaseAdmin
    .from("piece_responses")
    .select("piece_id")
    .eq("id", commentId)
    .single()
  if (!comment) throw new Error("Comment not found")
  const { data: piece } = await supabaseAdmin
    .from("content_objects")
    .select("author_id")
    .eq("id", comment.piece_id)
    .maybeSingle()
  if (!piece || piece.author_id !== authData.user.id)
    throw new Error("Unauthorized")

  const { error } = await supabaseAdmin
    .from("piece_responses")
    .update({ is_pinned: isPinned })
    .eq("id", commentId)

  if (error) {
    console.error("[comments]", error)
    throw new Error("Couldn't update that response.")
  }
  return { success: true }
}


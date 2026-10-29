/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import DOMPurify from "isomorphic-dompurify"
import { getViewablePiece } from "@/actions/content/helpers"
import { checkRateLimit } from "@/lib/rate-limit.server"

// Pinned plus the newest MAX_COMMENTS; a reply whose parent falls outside is hidden.
// ponytail: hard cap, no "load older"; add cursor pagination when a piece nears it.
const MAX_COMMENTS = 300

export async function listComments(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: authData } = await (await createClient()).auth.getUser()
  const viewerId = authData?.user?.id ?? null

  const __handler = async ({ data }: { data: { piece_id: string } }) => {
    if (!(await getViewablePiece(supabaseAdmin, data.piece_id, viewerId))) return []
    const { data: rows, error } = await supabaseAdmin
      .from("piece_responses")
      .select("id, body, created_at, user_id, parent_id, sources, quoted_text, serialized_range, is_pinned")
      .eq("piece_id", data.piece_id)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(MAX_COMMENTS)

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
  return await __handler({ data: args?.data as { piece_id: string } })
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
    if (!(await getViewablePiece(supabaseAdmin, data.piece_id, userId)))
      throw new Error("Piece not found")
    if (data.parent_id) {
      const { data: parent } = await supabaseAdmin
        .from("piece_responses")
        .select("piece_id")
        .eq("id", data.parent_id)
        .maybeSingle()
      if (!parent || parent.piece_id !== data.piece_id)
        throw new Error("Reply target not found")
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
      body: sanitizedBody,
      ...(data.parent_id ? { parent_id: data.parent_id } : {}),
      ...(data.quoted_text ? { quoted_text: data.quoted_text } : {}),
      ...(data.serialized_range ? { serialized_range: data.serialized_range } : {}),
    }).select(`
      *,
      author:profiles!user_id(handle, display_name, avatar_url)
    `).single()
    if (error) throw new Error(error.message)
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

  if (error) throw new Error(error.message)
  return { success: true }
}

export async function toggleCommentVote(commentId: string, voteType: 1 | -1 | 0) {
  const supabaseAdmin = await createAdminClient()
  const { data: authData } = await (await createClient()).auth.getUser()
  if (!authData?.user) throw new Error("Unauthorized")
  const userId = authData.user.id

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
    if (error) throw new Error(error.message)
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

  if (error) throw new Error(error.message)
  return { success: true }
}


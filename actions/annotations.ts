/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"
import { getViewablePiece } from "@/actions/content/helpers"
import { assertCanPost } from "@/lib/parental-consent"
import { checkRateLimit } from "@/lib/rate-limit.server"

const MAX_BODY = 2000

export async function listBlockAnnotations(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const __handler = async ({
    data,
  }: {
    data: { content_object_id: string }
  }) => {
    // Notes on drafts and members-only pieces stay with people who can open them.
    if (!(await getViewablePiece(supabaseAdmin, data.content_object_id, _auth?.user?.id ?? null))) return []
    const { data: rows, error } = await supabaseAdmin
      .from("block_annotations")
      .select("id, block_id, body, user_id, created_at")
      .eq("content_object_id", data.content_object_id)
      .order("created_at", { ascending: true })
      .limit(500)
    if (error) throw new Error("Request failed")
    const userIds = Array.from(
      new Set((rows ?? []).map((r: { user_id: string }) => r.user_id))
    )
    const { data: profiles } = userIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, handle, display_name")
          .in("id", userIds)
      : { data: [] }
    const pmap = new Map(
      (profiles ?? []).map(
        (p: { id: string; handle: string; display_name: string }) => [p.id, p]
      )
    )
    return (rows ?? []).map(
      (r: {
        id: string
        block_id: string
        body: string
        user_id: string
        created_at: string
      }) => ({
        ...r,
        user: pmap.get(r.user_id) ?? null,
      })
    )
  }
  return await __handler({ data: args?.data as { content_object_id: string } })
}

export async function createBlockAnnotation(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { content_object_id: string; block_id: string; body: string }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")
    await assertCanPost(context.userId)
    const body = String(data.body ?? "").trim()
    if (!body) throw new Error("Write something first.")
    if (body.length > MAX_BODY) throw new Error(`Keep it under ${MAX_BODY} characters.`)
    if (!(await getViewablePiece(supabaseAdmin, data.content_object_id, context.userId)))
      throw new Error("Piece not found")
    const { data: block } = await supabaseAdmin
      .from("blocks")
      .select("content_object_id")
      .eq("id", data.block_id)
      .maybeSingle()
    if (!block || block.content_object_id !== data.content_object_id)
      throw new Error("Block not found")
    const rl = await checkRateLimit("annotate", context.userId, 30, 600)
    if (!rl.ok) throw new Error("You're posting a lot. Try again in a few minutes.")
    const { data: row, error } = await context.supabase
      .from("block_annotations")
      .insert({
        content_object_id: data.content_object_id,
        block_id: data.block_id,
        user_id: context.userId,
        body,
      })
      .select("id, block_id, body, user_id, created_at")
      .single()
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    const { tickQuest } = await import("@/lib/quests.server")
    await tickQuest(context.userId!, "annotate_1")
    // reply_1 if annotating own piece
    const { data: piece } = await supabaseAdmin
      .from("content_objects")
      .select("author_id")
      .eq("id", data.content_object_id)
      .maybeSingle()
    if (piece?.author_id === context.userId)
      await tickQuest(context.userId!, "reply_1")
    return row
  }
  return await __handler({
    data: args?.data as {
      content_object_id: string
      block_id: string
      body: string
    },
    context,
  })
}

export async function deleteBlockAnnotation(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { id: string }
    context: ActionContext
  }) => {
    const { error } = await context.supabase
      .from("block_annotations")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId!)
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { ok: true }
  }
  return await __handler({
    data: args?.data as { id: string },
    context,
  })
}

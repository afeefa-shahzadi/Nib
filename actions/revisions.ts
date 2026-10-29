/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"

export async function listRevisionsForPiece(args: { data?: any } = {}) {
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
    data: { content_object_id: string }
    context: ActionContext
  }) => {
    const { data: piece } = await context.supabase
      .from("content_objects")
      .select("author_id")
      .eq("id", data.content_object_id)
      .maybeSingle()
    if (!piece || piece.author_id !== context.userId)
      throw new Error("Not authorized")
    const { data: rows, error } = await context.supabase
      .from("block_revisions")
      .select("id, block_id, type, content, semantic_role, created_at")
      .eq("content_object_id", data.content_object_id)
      .order("created_at", { ascending: false })
      .limit(100)
    if (error) throw new Error("Request failed")
    return rows ?? []
  }
  return await __handler({
    data: args?.data as { content_object_id: string },
    context,
  })
}

export async function restoreBlockRevision(args: { data?: any } = {}) {
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
    data: { revision_id: string }
    context: ActionContext
  }) => {
    const { data: rev, error: e1 } = await context.supabase
      .from("block_revisions")
      .select("block_id, type, content, semantic_role, content_object_id")
      .eq("id", data.revision_id)
      .maybeSingle()
    if (e1 || !rev) throw new Error("Revision not found")
    const { data: piece } = await context.supabase
      .from("content_objects")
      .select("author_id")
      .eq("id", rev.content_object_id)
      .maybeSingle()
    if (!piece || piece.author_id !== context.userId)
      throw new Error("Not authorized")
    const { error: e2 } = await context.supabase
      .from("blocks")
      .update({ content: rev.content, semantic_role: rev.semantic_role })
      .eq("id", rev.block_id)
    if (e2) {
      console.error("[server]", e2)
      throw new Error("Request failed. Please try again.")
    }
    return { ok: true }
  }
  return await __handler({
    data: args?.data as { revision_id: string },
    context,
  })
}

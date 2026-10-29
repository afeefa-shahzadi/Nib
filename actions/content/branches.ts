/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"
import { SupabaseClient } from "@supabase/supabase-js"

// Branch ownership routes through its parent piece's author.
async function assertBranchOwner(
  supabase: SupabaseClient,
  branchId: string,
  userId: string | undefined
) {
  const { data: branch } = await supabase
    .from("branches")
    .select("parent_object_id")
    .eq("id", branchId)
    .maybeSingle()
  if (!branch) throw new Error("Not authorized")
  const { data: piece } = await supabase
    .from("content_objects")
    .select("author_id")
    .eq("id", branch.parent_object_id)
    .maybeSingle()
  if (!piece || piece.author_id !== userId) throw new Error("Not authorized")
}

// The table carries two generations of columns: the original
// `parent_content_object_id`/`type` pair (still NOT NULL, and what every RLS
// policy on `branches` keys off) and the newer `parent_object_id`/`branch_type`
// pair the app reads. Inserts must fill both or they fail the NOT NULL check
// and the policy's WITH CHECK. `type` is an enum whose labels differ from the
// UI's BRANCH_TYPES values for two entries.
const BRANCH_TYPE_TO_ENUM: Record<string, string> = {
  audio: "audio",
  teaching: "teach",
  premium: "premium_update",
  debate: "debate",
  localized: "localized",
}

// ---------- CREATOR: branches ----------
export async function createBranch(args: { data?: any } = {}) {
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
    data: {
      parent_object_id: string
      branch_type: string
      purpose?: string | null
      visibility: string
      summary?: string | null
    }
    context: ActionContext
  }) => {
    const { data: piece, error: pErr } = await context.supabase
      .from("content_objects")
      .select("id, author_id")
      .eq("id", data.parent_object_id)
      .maybeSingle()
    if (pErr) {
      console.error("[server]", pErr)
      throw new Error("Request failed. Please try again.")
    }
    if (!piece || piece.author_id !== context.userId)
      throw new Error("Not authorized")

    const { error } = await context.supabase.from("branches").insert({
      parent_object_id: data.parent_object_id,
      parent_content_object_id: data.parent_object_id,
      type: BRANCH_TYPE_TO_ENUM[data.branch_type] ?? "teach",
      branch_type: data.branch_type,
      purpose: data.purpose ?? null,
      visibility: data.visibility,
      summary: data.summary ?? null,
      state: "published",
    })
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { ok: true }
  }
  return await __handler({
    data: args?.data as {
      parent_object_id: string
      branch_type: string
      purpose?: string | null
      visibility: string
      summary?: string | null
    },
    context,
  })
}

export async function deleteBranch(args: { data?: any } = {}) {
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
    await assertBranchOwner(context.supabase, data.id, context.userId)
    const { error } = await context.supabase
      .from("branches")
      .delete()
      .eq("id", data.id)
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

export async function updateBranch(args: { data?: any } = {}) {
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
    data: {
      id: string
      purpose?: string | null
      summary?: string | null
      visibility?: string
      state?: string
    }
    context: ActionContext
  }) => {
    const patch: Record<string, unknown> = {}
    for (const k of ["purpose", "summary", "visibility", "state"] as const) {
      if (data[k] !== undefined) patch[k] = data[k]
    }

    await assertBranchOwner(context.supabase, data.id, context.userId)
    const { error } = await context.supabase
      .from("branches")
      .update(patch)
      .eq("id", data.id)
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { ok: true }
  }
  return await __handler({
    data: args?.data as {
      id: string
      purpose?: string | null
      summary?: string | null
      visibility?: string
      state?: string
    },
    context,
  })
}

// ---------- CREATOR: branches list ----------
export async function listMyBranches() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    const { data: pieces } = await context.supabase
      .from("content_objects")
      .select("id, title, slug")
      .eq("author_id", context.userId)
    const pieceIds = (pieces ?? []).map((p: { id: string }) => p.id)
    if (pieceIds.length === 0) return { pieces: pieces ?? [], branches: [] }
    const { data: branches, error } = await context.supabase
      .from("branches")
      .select("*")
      .in("parent_object_id", pieceIds)
      .order("created_at", { ascending: false })
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { pieces: pieces ?? [], branches: branches ?? [] }
  }
  return await __handler({ context })
}

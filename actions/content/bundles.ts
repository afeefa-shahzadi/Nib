/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"
import { hasStudioAccess } from "@/lib/plan"
import { SupabaseClient } from "@supabase/supabase-js"
import { getViewablePiece } from "./helpers"

async function assertBundleOwner(
  supabase: SupabaseClient,
  bundleId: string,
  userId: string | undefined
) {
  const { data: bundle } = await supabase
    .from("bundles")
    .select("author_id")
    .eq("id", bundleId)
    .maybeSingle()
  if (!bundle || bundle.author_id !== userId) throw new Error("Not authorized")
}

// ---------- CREATOR: bundles ----------
export async function listMyBundles() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    const { data, error } = await context.supabase
      .from("bundles")
      .select("*")
      .eq("author_id", context.userId!)
      .order("created_at", { ascending: false })
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return data ?? []
  }
  return await __handler({ context })
}

export async function createBundle(args: { data?: any } = {}) {
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
      title: string
      description?: string | null
      outcome?: string | null
      price_cents: number
      is_public: boolean
    }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")
    const { data: profile } = await context.supabase.from("profiles").select("plan").eq("id", context.userId).single()
    if (!hasStudioAccess(profile?.plan)) {
      throw new Error("This feature requires the Studio or Organizations plan.")
    }

    // bundles.workspace_id is NOT NULL and ownership is tracked on author_id
    // (there is no owner_id column) — resolve the personal workspace the same
    // way pieces and tiers do.
    const { ensureUserWorkspace } = await import("./helpers")
    const workspaceId = await ensureUserWorkspace(
      context.supabase,
      context.userId!
    )

    const { data: b, error } = await context.supabase.from("bundles").insert({
      author_id: context.userId,
      workspace_id: workspaceId,
      title: data.title,
      description: data.description ?? null,
      outcome_statement: data.outcome ?? null,
      price: data.price_cents,
      visibility: data.is_public ? "public" : "private",
    }).select("id").single()
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { ok: true, bundleId: b?.id }
  }
  return await __handler({
    data: args?.data as {
      title: string
      description?: string | null
      outcome?: string | null
      price_cents: number
      is_public: boolean
    },
    context,
  })
}

export async function deleteBundle(args: { data?: any } = {}) {
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
    const { data: profile } = await context.supabase.from("profiles").select("plan").eq("id", context.userId).single()
    if (!hasStudioAccess(profile?.plan)) {
      throw new Error("This feature requires the Studio or Organizations plan.")
    }

    const { error } = await context.supabase
      .from("bundles")
      .delete()
      .eq("id", data.id)
      .eq("author_id", context.userId!)
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

export async function updateBundle(args: { data?: any } = {}) {
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
      title?: string
      description?: string | null
      outcome?: string | null
      price_cents?: number
      is_public?: boolean
    }
    context: ActionContext
  }) => {
    const { data: profile } = await context.supabase.from("profiles").select("plan").eq("id", context.userId).single()
    if (!hasStudioAccess(profile?.plan)) {
      throw new Error("This feature requires the Studio or Organizations plan.")
    }

    const patch: Record<string, unknown> = {}
    if (data.title !== undefined) patch.title = data.title
    if (data.description !== undefined) patch.description = data.description
    if (data.outcome !== undefined) patch.outcome_statement = data.outcome
    if (data.price_cents !== undefined) patch.price = data.price_cents
    if (data.is_public !== undefined) patch.visibility = data.is_public ? "public" : "private"

    const { error } = await context.supabase
      .from("bundles")
      .update(patch)
      .eq("id", data.id)
      .eq("author_id", context.userId!)
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { ok: true }
  }
  return await __handler({
    data: args?.data as {
      id: string
      title?: string
      description?: string | null
      outcome?: string | null
      price_cents?: number
      is_public?: boolean
    },
    context,
  })
}

// ---------- CREATOR: bundle items ----------
export async function listBundleItems(args: { data?: any } = {}) {
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
    data: { bundle_id: string }
    context: ActionContext
  }) => {
    await assertBundleOwner(context.supabase, data.bundle_id, context.userId)
    const { data: items, error } = await context.supabase
      .from("bundle_items")
      .select("*")
      .eq("bundle_id", data.bundle_id)
      .order("position", { ascending: true })
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return items ?? []
  }
  return await __handler({
    data: args?.data as { bundle_id: string },
    context,
  })
}

export async function addBundleItem(args: { data?: any } = {}) {
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
      bundle_id: string
      content_object_id?: string | null
      branch_id?: string | null
    }
    context: ActionContext
  }) => {
    const { data: bundle, error: bErr } = await context.supabase
      .from("bundles")
      .select("id, author_id")
      .eq("id", data.bundle_id)
      .maybeSingle()
    if (bErr) {
      console.error("[server]", bErr)
      throw new Error("Request failed. Please try again.")
    }
    if (!bundle || bundle.author_id !== context.userId)
      throw new Error("Not authorized")
    // Only the caller's own work or published public work can go in a bundle.
    if (data.content_object_id &&
        !(await getViewablePiece(context.supabase, data.content_object_id, context.userId)))
      throw new Error("Piece not found")
    if (data.branch_id) {
      const { data: br } = await context.supabase
        .from("branches")
        .select("parent_object_id, state, visibility")
        .eq("id", data.branch_id)
        .maybeSingle()
      const parent = br
        ? await getViewablePiece(context.supabase, br.parent_object_id, context.userId)
        : null
      const own = parent?.author_id === context.userId
      if (!br || !parent || (!own && (br.state !== "published" || br.visibility !== "public")))
        throw new Error("Branch not found")
    }
    const { count } = await context.supabase
      .from("bundle_items")
      .select("*", { count: "exact", head: true })
      .eq("bundle_id", data.bundle_id)
    const { error } = await context.supabase.from("bundle_items").insert({
      bundle_id: data.bundle_id,
      content_object_id: data.content_object_id ?? null,
      branch_id: data.branch_id ?? null,
      position: count ?? 0,
    })
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { ok: true }
  }
  return await __handler({
    data: args?.data as {
      bundle_id: string
      content_object_id?: string | null
      branch_id?: string | null
    },
    context,
  })
}

export async function removeBundleItem(args: { data?: any } = {}) {
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
    const { data: item } = await context.supabase
      .from("bundle_items")
      .select("bundle_id")
      .eq("id", data.id)
      .maybeSingle()
    if (!item) throw new Error("Not authorized")
    await assertBundleOwner(context.supabase, item.bundle_id, context.userId)
    const { error } = await context.supabase
      .from("bundle_items")
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

export async function reorderBundleItems(args: { data?: any } = {}) {
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
    data: { bundle_id: string; ordered_ids: string[] }
    context: ActionContext
  }) => {
    const { data: bundle, error: bErr } = await context.supabase
      .from("bundles")
      .select("id, author_id")
      .eq("id", data.bundle_id)
      .maybeSingle()
    if (bErr || !bundle || bundle.author_id !== context.userId)
      throw new Error("Not authorized")
    for (let i = 0; i < data.ordered_ids.length; i++) {
      const { error } = await context.supabase
        .from("bundle_items")
        .update({ position: i })
        .eq("id", data.ordered_ids[i])
        .eq("bundle_id", data.bundle_id)
      if (error) {
        console.error("[server]", error)
        throw new Error("Reorder failed.")
      }
    }
    return { ok: true }
  }
  return await __handler({
    data: args?.data as { bundle_id: string; ordered_ids: string[] },
    context,
  })
}

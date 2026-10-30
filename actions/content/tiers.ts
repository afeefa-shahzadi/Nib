/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext, MembershipTier } from "@/lib/types/actions"
import { hasStudioAccess } from "@/lib/plan"

// ---------- PUBLIC: an author's paid plans, for the reader's subscribe dialog ----------
export async function listAuthorTiers(args: { data?: { authorId: string } } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data } = await supabaseAdmin
    .from("membership_tiers")
    .select("id, name, description, price_cents, perks")
    .eq("author_id", args.data?.authorId ?? "")
    .gt("price_cents", 0)
    .order("price_cents", { ascending: true })
  return data ?? []
}

// ---------- CREATOR: tiers ----------
export async function listMyTiers() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    const { data, error } = await context.supabase
      .from("membership_tiers")
      .select("*")
      .eq("author_id", context.userId)
      .order("price_cents", { ascending: true })
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    const { data: active } = await context.supabase
      .from("memberships")
      .select("tier_id")
      .eq("author_id", context.userId)
      .eq("status", "active")
    const tally = new Map<string, number>()
    for (const m of active ?? [])
      tally.set(m.tier_id, (tally.get(m.tier_id) ?? 0) + 1)
    return (data ?? []).map((t: MembershipTier) => ({
      ...t,
      supporters: tally.get(t.id) ?? 0,
    }))
  }
  return await __handler({ context })
}

export async function createTier(args: { data?: any } = {}) {
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
      name: string
      description?: string | null
      price_cents: number
      perks: string[]
    }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")
    const { data: profile } = await context.supabase.from("profiles").select("plan").eq("id", context.userId).single()
    if (!hasStudioAccess(profile?.plan)) {
      throw new Error("This feature requires the Studio or Organizations plan.")
    }

    // membership_tiers.workspace_id is NOT NULL; resolve (or create) the
    // creator's personal workspace like the piece mutations do.
    const { ensureUserWorkspace } = await import("./helpers")
    const workspaceId = await ensureUserWorkspace(
      context.supabase,
      context.userId!
    )

    const { error } = await context.supabase.from("membership_tiers").insert({
      author_id: context.userId,
      workspace_id: workspaceId,
      name: data.name,
      description: data.description ?? null,
      price_cents: data.price_cents,
      perks: data.perks,
    })
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { ok: true }
  }
  return await __handler({
    data: args?.data as {
      name: string
      description?: string | null
      price_cents: number
      perks: string[]
    },
    context,
  })
}

export async function updateTier(args: { data?: any } = {}) {
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
      name?: string
      description?: string | null
      price_cents?: number
      perks?: string[]
    }
    context: ActionContext
  }) => {
    const { data: profile } = await context.supabase.from("profiles").select("plan").eq("id", context.userId).single()
    if (!hasStudioAccess(profile?.plan)) {
      throw new Error("This feature requires the Studio or Organizations plan.")
    }

    const patch: Record<string, unknown> = {}
    for (const k of ["name", "description", "price_cents", "perks"] as const) {
      if (data[k] !== undefined) patch[k] = data[k]
    }

    const { error } = await context.supabase
      .from("membership_tiers")
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
      name?: string
      description?: string | null
      price_cents?: number
      perks?: string[]
    },
    context,
  })
}

export async function deleteTier(args: { data?: any } = {}) {
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
      .from("membership_tiers")
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

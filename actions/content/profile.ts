/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { normalizeLink, normalizeLinks } from "@/lib/profile-links"
import { createAdminClient, createServiceRoleClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"
import { encryptSecret } from "@/lib/crypto"
import { updateTag } from "next/cache"
import { HANDLE_RE } from "@/lib/handle"

// ---------- AUTH: current user's app role(s) ----------
export async function getMyRole() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    if (!context.userId) {
      return { roles: [], primary: "reader" }
    }
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    const roles = (data ?? []).map((r: { role: string }) => r.role as string)
    const primary: "reader" | "creator" | "admin" = roles.includes("admin")
      ? "admin"
      : roles.includes("creator")
        ? "creator"
        : "reader"
    return { roles, primary }
  }
  return await __handler({ context })
}

export async function getMyProfile() {
  const { data: _auth } = await (await createClient()).auth.getUser()
  // Authenticate via the cookie-aware client, read the row with the service
  // role (column grants deny `authenticated`). Scoped to the verified own id.
  const db = await createServiceRoleClient()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: db,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    if (!context.userId) return null

    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle()
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    if (!data) return data
    // Never ship the raw BYOK key to the client — expose only whether one is set.
    const { byok_api_key, ...rest } = data as Record<string, unknown>
    return { ...rest, byok_api_key_set: !!byok_api_key }
  }
  return await __handler({ context })
}

export async function updateMyProfile(args: { data?: any } = {}) {
  const { data: _auth } = await (await createClient()).auth.getUser()
  // The patch can include ungranted columns (byok_api_key, nsfw_enabled,
  // disability_*); updating them via the cookie client runs as `authenticated`
  // and is grant-denied, which fails the entire save. Auth via the cookie
  // client, write via the true service role, scoped to the verified own id.
  const db = await createServiceRoleClient()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: db,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: {
      display_name?: string
      handle?: string
      bio?: string
      avatar_url?: string
      byok_api_key?: string
      byok_provider?: string
      byok_model?: string
      nsfw_enabled?: boolean
      show_claps?: boolean
      show_birthday?: boolean
      hide_from_leaderboard?: boolean
      disability_visual?: boolean
      disability_cognitive?: boolean
      disability_hearing?: boolean
      disability_motor?: boolean
      website?: string | null
      links?: string[]
      pinned_piece_id?: string | null
    }
    context: ActionContext
  }) => {
    const patch: Record<string, unknown> = {}
    if (data.handle !== undefined) {
      data.handle = String(data.handle).trim().toLowerCase()
      if (!HANDLE_RE.test(data.handle)) throw new Error("Handles are 3–30 letters, numbers or _.")
      const { data: taken } = await context.supabase
        .from("profiles")
        .select("id")
        .eq("handle", data.handle)
        .neq("id", context.userId!)
        .maybeSingle()
      if (taken) throw new Error("That handle is taken.")
    }
    if (data.website !== undefined) patch.website = normalizeLink(data.website)
    if (data.links !== undefined) patch.links = normalizeLinks(data.links)
    if (data.pinned_piece_id !== undefined) {
      if (data.pinned_piece_id) {
        // Only your own published piece can be pinned.
        const { data: own } = await context.supabase
          .from("content_objects")
          .select("id")
          .eq("id", data.pinned_piece_id)
          .eq("author_id", context.userId!)
          .eq("status", "published")
          .maybeSingle()
        if (!own) throw new Error("You can only pin one of your published pieces.")
      }
      patch.pinned_piece_id = data.pinned_piece_id || null
    }
    for (const k of [
      "display_name",
      "handle",
      "bio",
      "avatar_url",
      "byok_api_key",
      "byok_provider",
      "byok_model",
      "nsfw_enabled",
      "show_claps",
      "show_birthday",
      "hide_from_leaderboard",
      "disability_visual",
      "disability_cognitive",
      "disability_hearing",
      "disability_motor",
    ] as const) {
      if (data[k] !== undefined) patch[k] = data[k]
    }

    // Encrypt the BYOK key at rest. Empty string / null clears it.
    if (patch.byok_api_key !== undefined) {
      try {
        patch.byok_api_key = patch.byok_api_key
          ? encryptSecret(patch.byok_api_key as string)
          : null
      } catch (e) {
        console.error("[server]", e)
        return { error: "AI key storage is not configured. Contact support." }
      }
    }

    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", context.userId)
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { ok: true }
  }
  const out = await __handler({
    data: args?.data as {
      display_name?: string
      handle?: string
      bio?: string
      avatar_url?: string
      byok_api_key?: string
      byok_provider?: string
      byok_model?: string
      nsfw_enabled?: boolean
      disability_visual?: boolean
      disability_cognitive?: boolean
      disability_hearing?: boolean
      disability_motor?: boolean
    },
    context,
  })
  updateTag("public")
  return out
}

// ---------- CREATOR: delete account (full wipe) ----------
export async function deleteMyAccount() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    if (!context.userId) throw new Error("Unauthorized")
    await context.supabase
      .from("content_objects")
      .delete()
      .eq("author_id", context.userId)
    await context.supabase
      .from("bundles")
      .delete()
      .eq("author_id", context.userId)
    await context.supabase
      .from("membership_tiers")
      .delete()
      .eq("author_id", context.userId)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId!)
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { ok: true }
  }
  return await __handler({ context })
}

export async function toggleAuthorMode(args: { data?: any } = {}) {
  const supabase = await createClient()
  const { data: _auth } = await supabase.auth.getUser()
  const supabaseService = await createServiceRoleClient()
  
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabase,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { enabled: boolean }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")
    if (data.enabled) {
      const { error } = await supabaseService
        .from("user_roles")
        .insert({ user_id: context.userId, role: "creator" })
      if (error && error.code !== "23505") {
        console.error("[server]", error)
        throw new Error("Failed to enable author mode")
      }
    } else {
      const { error } = await supabaseService
        .from("user_roles")
        .delete()
        .eq("user_id", context.userId)
        .eq("role", "creator")
      if (error) {
        console.error("[server]", error)
        throw new Error("Failed to disable author mode")
      }
    }
    return { ok: true }
  }
  return await __handler({
    data: args?.data as { enabled: boolean },
    context,
  })
}

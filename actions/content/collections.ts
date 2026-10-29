/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"

// ---------- READER ACTIONS: save to collection ----------
export async function listMyCollections() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    const { data, error } = await supabaseAdmin
      .from("collections")
      .select("id, title, is_personal, is_public")
      .eq("curator_id", context.userId)
      .order("created_at", { ascending: false })
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return data ?? []
  }
  return await __handler({ context })
}

export async function ensurePersonalCollection() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    if (!context.userId) throw new Error("Unauthorized")
    const { data: existing } = await supabaseAdmin
      .from("collections")
      .select("id")
      .eq("curator_id", context.userId)
      .eq("is_personal", true)
      .limit(1)
      .maybeSingle()
    if (existing) return { id: existing.id }
    const { data, error } = await supabaseAdmin
      .from("collections")
      .insert({
        curator_id: context.userId,
        title: "Saved",
        is_personal: true,
        is_public: false,
      })
      .select("id")
      .single()
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { id: data.id }
  }
  return await __handler({ context })
}

export async function savePiece(args: { data?: any } = {}) {
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
    data: { content_object_id: string; collection_id?: string | null }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")
    // Curator check FIRST: unsavePiece trusts saves.collection_id, so a saves
    // row must never point at a collection the caller doesn't own.
    if (data.collection_id) {
      const { data: collection } = await supabaseAdmin
        .from("collections")
        .select("curator_id")
        .eq("id", data.collection_id)
        .maybeSingle()
      if (!collection || collection.curator_id !== context.userId)
        throw new Error("Not authorized")
    }

    // de-dupe: remove existing save for the same piece in the same collection
    {
      const del = supabaseAdmin
        .from("saves")
        .delete()
        .eq("user_id", context.userId)
        .eq("content_object_id", data.content_object_id)
      await (data.collection_id
        ? del.eq("collection_id", data.collection_id)
        : del.is("collection_id", null))
    }

    const { error } = await supabaseAdmin.from("saves").insert({
      user_id: context.userId,
      content_object_id: data.content_object_id,
      collection_id: data.collection_id ?? null,
    })
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    if (data.collection_id) {
      // No user write policy on collection_items (curator checked above): the
      // cookie-bound client was silently denied, so every saved list was empty.
      const svc = supabaseAdmin
      await svc
        .from("collection_items")
        .delete()
        .eq("collection_id", data.collection_id)
        .eq("content_object_id", data.content_object_id)
      const { error: iErr } = await svc.from("collection_items").insert({
        collection_id: data.collection_id,
        content_object_id: data.content_object_id,
      })
      if (iErr) {
        console.error("[server]", iErr)
        throw new Error("Request failed. Please try again.")
      }
    }
    return { ok: true }
  }
  return await __handler({
    data: args?.data as {
      content_object_id: string
      collection_id?: string | null
    },
    context,
  })
}

export async function unsavePiece(args: { data?: any } = {}) {
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
    const { data: rows } = await supabaseAdmin
      .from("saves")
      .select("collection_id")
      .eq("user_id", context.userId)
      .eq("content_object_id", data.content_object_id)
    const { error: sErr } = await supabaseAdmin
      .from("saves")
      .delete()
      .eq("user_id", context.userId)
      .eq("content_object_id", data.content_object_id)
    if (sErr) {
      console.error("[server]", sErr)
      throw new Error("Couldn't remove it from your saved list. Please try again.")
    }
    // Drop it from the lists it was saved into — but only lists the caller
    // curates: this runs as the service role, so saves.collection_id alone
    // must not be trusted.
    const ids = (rows ?? []).map((r: { collection_id: string | null }) => r.collection_id).filter(Boolean)
    if (ids.length > 0) {
      const { data: owned } = await supabaseAdmin
        .from("collections")
        .select("id")
        .in("id", ids)
        .eq("curator_id", context.userId)
      const ownedIds = (owned ?? []).map((c: { id: string }) => c.id)
      if (ownedIds.length > 0) {
        const { error } = await supabaseAdmin
          .from("collection_items")
          .delete()
          .in("collection_id", ownedIds)
          .eq("content_object_id", data.content_object_id)
        if (error) {
          console.error("[server]", error)
          throw new Error("Couldn't remove it from your list. Please try again.")
        }
      }
    }
    return { ok: true }
  }
  return await __handler({
    data: args?.data as { content_object_id: string },
    context,
  })
}

export async function isSaved(args: { data?: any } = {}) {
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
    const { data: rows } = await supabaseAdmin
      .from("saves")
      .select("id")
      .eq("user_id", context.userId)
      .eq("content_object_id", data.content_object_id)
      .limit(1)
    return { saved: (rows?.length ?? 0) > 0 }
  }
  return await __handler({
    data: args?.data as { content_object_id: string },
    context,
  })
}

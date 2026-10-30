/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { excludeNsfw } from "@/lib/nsfw"
import { ActionContext } from "@/lib/types/actions"

// ============== ANNOTATION UPVOTES ==============
export async function upvoteAnnotation(args: { data?: any } = {}) {
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
    data: { annotationId: string }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")

    const { error } = await supabaseAdmin
      .from("annotation_upvotes")
      .insert({ annotation_id: data.annotationId, user_id: context.userId })
    if (error && !error.message.includes("duplicate")) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }

    // Award the annotation's author 10 points — only on a genuinely new upvote
    // (not a duplicate) and never for upvoting your own annotation. Kept inline
    // (not a standalone server action) so it can't be invoked to mint points for
    // an arbitrary user. Service-role insert: a user-token insert to another
    // user's points row is blocked by RLS.
    if (!error) {
      const { data: annotation } = await supabaseAdmin
        .from("annotations")
        .select("user_id")
        .eq("id", data.annotationId)
        .single()
      if (
        annotation &&
        annotation.user_id &&
        annotation.user_id !== context.userId
      ) {
        const { error: ptsErr } = await supabaseAdmin
          .from("insight_points")
          .insert({
            user_id: annotation.user_id,
            points: 10,
            reason: "annotation_upvoted",
          } as never)
        if (ptsErr) console.error("[server] award upvote points", ptsErr)
      }
    }

    return { success: true }
  }
  return await __handler({
    data: args?.data as { annotationId: string },
    context,
  })
}

export async function removeUpvote(args: { data?: any } = {}) {
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
    data: { annotationId: string }
    context: ActionContext
  }) => {
    await supabaseAdmin
      .from("annotation_upvotes")
      .delete()
      .eq("annotation_id", data.annotationId)
      .eq("user_id", context.userId!)
    return { success: true }
  }
  return await __handler({
    data: args?.data as { annotationId: string },
    context,
  })
}

export async function listAnnotationUpvotes(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()

  const __handler = async ({ data }: { data: { annotationIds: string[] } }) => {
    if (data.annotationIds.length === 0)
      return { counts: {}, mine: [] as string[] }
    const { data: rows } = await supabaseAdmin
      .from("annotation_upvotes")
      .select("annotation_id, user_id")
      .in("annotation_id", data.annotationIds)
    const counts: Record<string, number> = {}
    for (const r of rows ?? [])
      counts[r.annotation_id] = (counts[r.annotation_id] ?? 0) + 1
    return { counts }
  }
  return await __handler({
    data: args?.data as { annotationIds: string[] },
  })
}

// ============== COLLECTIONS ==============
export async function createCollection(args: { data?: any } = {}) {
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
      is_public?: boolean
      price_paise?: number
    }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")
    const { data: row, error } = await supabaseAdmin
      .from("collections")
      .insert({
        curator_id: context.userId,
        title: data.title,
        description: data.description ?? null,
        // The caller sends visibility and price; `myCollections` renders both,
        // so persist them instead of silently dropping to the column defaults.
        is_public: data.is_public ?? true,
        price_paise: Math.max(0, Math.trunc(data.price_paise ?? 0)),
      })
      .select("id")
      .single()
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { id: row.id }
  }
  return await __handler({
    data: args?.data as {
      title: string
      description?: string | null
      is_public?: boolean
      price_paise?: number
    },
    context,
  })
}

export async function addToCollection(args: { data?: any } = {}) {
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
    data: { collectionId: string; contentObjectId: string }
    context: ActionContext
  }) => {
    const { data: c } = await supabaseAdmin
      .from("collections")
      .select("curator_id")
      .eq("id", data.collectionId)
      .single()
    if (!c || c.curator_id !== context.userId)
      throw new Error("Not your collection")
    // collection_items has no user write policy (curator is checked above);
    // the cookie-bound client is denied, so write with the service role.
    const svc = supabaseAdmin
    const { error } = await svc.from("collection_items").insert({
      collection_id: data.collectionId,
      content_object_id: data.contentObjectId,
    })
    if (error && !error.message.includes("duplicate")) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { success: true }
  }
  return await __handler({
    data: args?.data as { collectionId: string; contentObjectId: string },
    context,
  })
}

export async function removeFromCollection(args: { data?: any } = {}) {
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
    data: { collectionId: string; contentObjectId: string }
    context: ActionContext
  }) => {
    const { data: c } = await supabaseAdmin
      .from("collections")
      .select("curator_id")
      .eq("id", data.collectionId)
      .single()
    if (!c || c.curator_id !== context.userId)
      throw new Error("Not your collection")
    await supabaseAdmin
      .from("collection_items")
      .delete()
      .eq("collection_id", data.collectionId)
      .eq("content_object_id", data.contentObjectId)
    return { success: true }
  }
  return await __handler({
    data: args?.data as { collectionId: string; contentObjectId: string },
    context,
  })
}

export async function listPublicCollections() {
  const supabaseAdmin = await createAdminClient()

  const __handler = async () => {
    const { data } = await supabaseAdmin
      .from("collections")
      .select("id, title, description, curator_id, created_at, collection_type")
      // Without this, private lists (other readers' "Saved") were listed
      // publicly and then 404'd when opened.
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(50)
    if (!data || data.length === 0) return []
    const curatorIds = [
      ...new Set(data.map((c: { curator_id: string }) => c.curator_id)),
    ]
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, handle, display_name, avatar_url")
      .in("id", curatorIds)
    const map = new Map(
      (profs ?? []).map(
        (p: {
          id: string
          handle: string | null
          display_name: string
          avatar_url: string | null
        }) => [p.id, p]
      )
    )
    const { data: items } = await supabaseAdmin
      .from("collection_items")
      .select("collection_id")
      .in("collection_id", data.map((c: { id: string }) => c.id))
    const counts = new Map<string, number>()
    for (const i of items ?? []) counts.set(i.collection_id, (counts.get(i.collection_id) ?? 0) + 1)
    // Empty lists are noise on a public index; curators still see them in Studio.
    return data
      .map((c: { id: string; curator_id: string }) => ({
        ...c,
        curator: map.get(c.curator_id) ?? null,
        piece_count: counts.get(c.id) ?? 0,
      }))
      .filter((c) => c.piece_count > 0)
  }
  return await __handler()
}

export async function getCollection(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const viewerId = _auth?.user?.id

  const __handler = async ({ data }: { data: { id: string } }) => {
    const { data: col } = await supabaseAdmin
      .from("collections")
      .select("*")
      .eq("id", data.id)
      .single()
    // Private collections (incl. the personal "Saved" list) are viewable by
    // their curator — every link to one used to 404 for its own owner.
    if (!col || (!col.is_public && col.curator_id !== viewerId))
      throw new Error("Not found")
    const { data: items } = await supabaseAdmin
      .from("collection_items")
      // collection_items has no `position` column — ordering by it made the
      // query fail and every collection render empty. Insertion order it is.
      .select("content_object_id, created_at")
      .eq("collection_id", data.id)
      .order("created_at")
    const ids = (items ?? []).map(
      (i: { content_object_id: string }) => i.content_object_id
    )
    const { data: pieces } = ids.length
      ? await excludeNsfw(
          supabaseAdmin
            .from("content_objects")
            .select("id, title, slug, summary, author_id, published_at, tags")
            .in("id", ids)
            .eq("status", "published")
            .eq("visibility", "public")
        )
      : { data: [] }
    const { data: curator } = await supabaseAdmin
      .from("profiles")
      .select("id, handle, display_name, avatar_url, bio")
      .eq("id", col.curator_id)
      .single()
    // A collection holds other authors' pieces; the reader URL needs each
    // piece's own author handle, not the curator's (that link 404'd).
    const authorIds = [...new Set((pieces ?? []).map((p: { author_id: string }) => p.author_id))]
    const { data: authors } = authorIds.length
      ? await supabaseAdmin.from("profiles").select("id, handle").in("id", authorIds)
      : { data: [] }
    const handleOf = new Map((authors ?? []).map((a: { id: string; handle: string }) => [a.id, a.handle]))
    return {
      collection: col,
      // .in() returns rows in arbitrary order; restore the curated item order.
      pieces: (pieces ?? [])
        .sort((a: { id: string }, b: { id: string }) => ids.indexOf(a.id) - ids.indexOf(b.id))
        .map((p) => ({
        ...p,
        author_handle: (handleOf.get(p.author_id) as string | undefined) ?? null,
      })),
      curator,
    }
  }
  return await __handler({
    data: args?.data as { id: string },
  })
}

export async function listCollectionsByCurator(curatorId: string) {
  const supabaseAdmin = await createAdminClient()
  const { data } = await supabaseAdmin
    .from("collections")
    .select("id, title, description, created_at")
    .eq("curator_id", curatorId)
    .eq("is_public", true)
    .order("created_at")
  return data ?? []
}

export async function myCollections() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    const { data } = await supabaseAdmin
      .from("collections")
      .select("id, title, description, is_public, price_paise, created_at")
      .eq("curator_id", context.userId!)
      .order("created_at", { ascending: false })
    return data ?? []
  }
  return await __handler({ context })
}

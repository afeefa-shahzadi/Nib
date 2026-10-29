/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"

export async function createPieceVersion(args: { data?: any } = {}) {
  const supabase = await createClient()
  const { data: _auth } = await supabase.auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabase,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: {
      piece_id: string
      message: string
      is_auto?: boolean
      blocks_snapshot: Record<string, unknown>[]
    }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")
    
    // Validate if user has access to piece
    const { data: piece } = await context.supabase
      .from("content_objects")
      .select("id")
      .eq("id", data.piece_id)
      .single()
      
    if (!piece) throw new Error("Piece not found or unauthorized")

    const { data: version, error } = await context.supabase
      .from("piece_versions")
      .insert({
        piece_id: data.piece_id,
        author_id: context.userId,
        message: data.message,
        is_auto: data.is_auto ?? false,
        blocks_snapshot: data.blocks_snapshot,
      })
      .select()
      .single()

    if (error) {
      console.error("[server]", error)
      throw new Error("Failed to create version")
    }

    return version
  }
  return await __handler({
    data: args?.data as { piece_id: string; message: string; is_auto?: boolean; blocks_snapshot: Record<string, unknown>[] },
    context,
  })
}

export async function listPieceVersions(args: { data?: any } = {}) {
  const supabase = await createClient()
  const { data: _auth } = await supabase.auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabase,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { piece_id: string }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")

    const { data: versions, error } = await context.supabase
      .from("piece_versions")
      .select(`
        id,
        piece_id,
        author_id,
        message,
        is_auto,
        created_at
      `)
      .eq("piece_id", data.piece_id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[server]", error)
      throw new Error("Failed to fetch versions")
    }

    // Fetch author profiles separately
    const authorIds = Array.from(new Set(versions.map(v => v.author_id)))
    const { data: profiles } = authorIds.length > 0 
      ? await context.supabase
          .from("profiles")
          .select("id, display_name, handle")
          .in("id", authorIds)
      : { data: [] }

    const profileMap = new Map(profiles?.map(p => [p.id, { display_name: p.display_name, handle: p.handle }]))

    return versions.map(v => ({
      ...v,
      author: profileMap.get(v.author_id) ?? null
    }))
  }
  return await __handler({
    data: args?.data as { piece_id: string },
    context,
  })
}

export async function getPieceVersion(args: { data?: any } = {}) {
  const supabase = await createClient()
  const { data: _auth } = await supabase.auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabase,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { version_id: string }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")

    const { data: version, error } = await context.supabase
      .from("piece_versions")
      .select("*")
      .eq("id", data.version_id)
      .single()

    if (error || !version) {
      console.error("[server]", error)
      throw new Error("Failed to fetch version details")
    }

    return version
  }
  return await __handler({
    data: args?.data as { version_id: string },
    context,
  })
}

export async function restorePieceVersion(args: { data?: any } = {}) {
  const supabase = await createClient()
  const { data: _auth } = await supabase.auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabase,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { version_id: string }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")

    // Fetch the version
    const { data: version, error: vErr } = await context.supabase
      .from("piece_versions")
      .select("*")
      .eq("id", data.version_id)
      .single()

    if (vErr || !version) {
      console.error("[server]", vErr)
      throw new Error("Version not found")
    }

    // Only the piece's author may restore it. Fetching by id alone and then
    // mutating blocks would let any signed-in user overwrite someone else's
    // piece if RLS on `blocks` were ever relaxed.
    const { data: piece } = await context.supabase
      .from("content_objects")
      .select("author_id")
      .eq("id", version.piece_id)
      .maybeSingle()
    if (!piece || piece.author_id !== context.userId)
      throw new Error("Not authorized")

    // Build (and thereby validate) the snapshot rows BEFORE deleting anything,
    // so a malformed snapshot can't leave the piece with zero blocks.
    const snapshot =
      version.blocks_snapshot && Array.isArray(version.blocks_snapshot)
        ? (version.blocks_snapshot as Record<string, unknown>[])
        : []
    const insertRows = snapshot.map((b, idx: number) => ({
      content_object_id: version.piece_id,
      order: idx,
      type: b.type,
      semantic_role: b.semantic_role ?? "none",
      content: b.content,
      mode_visibility: b.mode_visibility ?? ["skim", "standard", "expert", "teach", "debate"],
      monetization_eligible: b.monetization_eligible ?? false,
      is_nsfw: b.is_nsfw ?? false,
    }))

    // ponytail: delete-then-insert is not atomic across two PostgREST calls — a
    // mid-insert DB failure can leave the piece empty. Upgrade to a Postgres
    // function (single transaction) if this ever bites. Pre-validating the rows
    // above removes the common (bad-data) cause of that loss.
    await context.supabase
      .from("blocks")
      .delete()
      .eq("content_object_id", version.piece_id)

    // Return the inserted rows, not the snapshot: the snapshot carries the ids
    // its blocks had back then, which the delete above just removed. A client
    // that adopted those ids had its next autosave prune every restored block
    // (saveBlocks deletes rows whose id isn't in the payload).
    let restored: Record<string, unknown>[] = []
    if (insertRows.length > 0) {
      const { data: inserted, error: bErr } = await context.supabase
        .from("blocks")
        .insert(insertRows)
        .select("id, order, type, content, semantic_role, mode_visibility, monetization_eligible, is_nsfw")

      if (bErr) {
        console.error("[server]", bErr)
        throw new Error("Failed to restore blocks")
      }
      restored = [...(inserted ?? [])].sort(
        (a, b) => (a.order as number) - (b.order as number)
      )
    }

    // Create a new version representing the reversion to preserve history
    await context.supabase
      .from("piece_versions")
      .insert({
        piece_id: version.piece_id,
        author_id: context.userId,
        message: `Reverted to: ${version.message}`,
        is_auto: false,
        blocks_snapshot: version.blocks_snapshot,
      })

    return { ok: true, blocks: restored }
  }
  return await __handler({
    data: args?.data as { version_id: string },
    context,
  })
}

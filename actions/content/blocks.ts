/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"
import { notifyPieceMentions } from "@/lib/activity-notifications"

export async function saveBlocks(args: { data?: any } = {}) {
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
      content_object_id: string
      blocks: Array<{
        id?: string
        type: string
        content: any
        semantic_role?: string | null
        mode_visibility: any
        monetization_eligible: boolean
        is_nsfw?: boolean | null
        is_dirty?: boolean
      }>
    }
    context: ActionContext
  }) => {
    // verify ownership
    const { data: piece, error: pErr } = await context.supabase
      .from("content_objects")
      .select("id, author_id, status")
      .eq("id", data.content_object_id)
      .maybeSingle()
    if (pErr) {
      console.error("[server]", pErr)
      throw new Error("Request failed. Please try again.")
    }
    if (!piece || piece.author_id !== context.userId)
      throw new Error("Not authorized")

    // 1. Determine payload IDs
    const payloadIds = data.blocks.map((b) => b.id).filter(Boolean) as string[]

    // Reject any client-supplied block id that belongs to a different piece —
    // otherwise the upsert below would reassign it into this piece (hijack).
    if (payloadIds.length > 0) {
      const { data: existing } = await context.supabase
        .from("blocks")
        .select("id, content_object_id")
        .in("id", payloadIds)
      if (
        (existing ?? []).some(
          (b: { content_object_id: string }) =>
            b.content_object_id !== data.content_object_id
        )
      )
        throw new Error("Not authorized")
    }

    // 2. Delete blocks that were removed by the client
    if (payloadIds.length > 0) {
      const { error: delErr } = await context.supabase
        .from("blocks")
        .delete()
        .eq("content_object_id", data.content_object_id)
        .not("id", "in", `(${payloadIds.join(",")})`)
      if (delErr) throw new Error("Failed to prune removed blocks")
    } else {
      const { error: delErr } = await context.supabase
        .from("blocks")
        .delete()
        .eq("content_object_id", data.content_object_id)
      if (delErr) throw new Error("Failed to prune removed blocks")
    }

    if (data.blocks.length === 0) return { ok: true }
    const published = piece.status === "published"

    const blocksWithOrder = data.blocks.map((b, idx: number) => ({
      ...b,
      order: idx,
    }))

    const dirtyBlocks = blocksWithOrder.filter((b) => b.is_dirty || !b.id)
    const cleanBlocks = blocksWithOrder.filter((b) => !b.is_dirty && b.id)

    // 3. Upsert blocks that have content changes or are entirely new.
    // PostgREST rejects a batch whose rows don't all carry the same keys
    // (PGRST102 "All object keys must match"), so existing blocks (which send
    // an id) and brand-new ones (which don't) have to go in separate requests.
    // Editing an existing block in the same pass as adding a new one is the
    // common case, and mixing them lost the whole save.
    if (dirtyBlocks.length > 0) {
      const row = (b: (typeof dirtyBlocks)[number]) => ({
        content_object_id: data.content_object_id,
        order: b.order,
        type: b.type,
        content: b.content,
        semantic_role: b.semantic_role ?? null,
        mode_visibility: b.mode_visibility,
        monetization_eligible: b.monetization_eligible,
        is_nsfw: b.is_nsfw ?? false,
      })
      const existingRows = dirtyBlocks
        .filter((b) => b.id)
        .map((b) => ({ id: b.id, ...row(b) }))
      const newRows = dirtyBlocks.filter((b) => !b.id).map(row)

      if (existingRows.length > 0) {
        const { error: upErr } = await context.supabase
          .from("blocks")
          .upsert(existingRows)
        if (upErr) {
          console.error("[server]", upErr)
          throw new Error("Failed to save block content")
        }
      }
      if (newRows.length > 0) {
        const { error: insErr } = await context.supabase
          .from("blocks")
          .insert(newRows)
        if (insErr) {
          console.error("[server]", insErr)
          throw new Error("Failed to save block content")
        }
      }
    }

    // 4. Update ONLY the order for blocks that were just moved around without content edits
    if (cleanBlocks.length > 0) {
      const { error: orderErr } = await Promise.all(
        cleanBlocks.map((b) =>
          context.supabase
            .from("blocks")
            .update({ order: b.order })
            .eq("id", b.id!)
        )
      ).then((res) => {
        const err = res.find((r) => r.error)
        return { error: err?.error }
      })
      
      if (orderErr) {
        console.error("[server] Order update error", orderErr)
        throw new Error("Failed to sync block ordering")
      }
    }

    // Editing a published piece: newly added @mentions notify (once per person per piece).
    if (published) await notifyPieceMentions(context.supabase, data.content_object_id)
    return { ok: true }
  }
  return await __handler({
    data: args?.data as {
      content_object_id: string
      blocks: Array<{
        id?: string
        type: string
        content: any
        semantic_role?: string | null
        mode_visibility: any
        monetization_eligible: boolean
        is_nsfw?: boolean | null
        is_dirty?: boolean
      }>
    },
    context,
  })
}

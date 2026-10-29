/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"
import { ensureUserWorkspace } from "./helpers"

// ---------- READER ACTIONS: repost with credits ----------
export async function repostPiece(args: { data?: any } = {}) {
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
      original_piece_id: string
      add_credits?: boolean
      note?: string | null
    }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")
    const { data: original } = await supabaseAdmin
      .from("content_objects")
      .select("id, title, slug, author_id, repost_credits_required, summary, status, visibility")
      .eq("id", data.original_piece_id)
      .single()
    if (!original) throw new Error("Original piece not found")
    // Only public, published pieces can be reposted — otherwise a draft's
    // title/summary leak into a new public repost.
    if (original.status !== "published" || original.visibility !== "public")
      throw new Error("Only published public pieces can be reposted")
    const mustCredit = !!original.repost_credits_required
    const credited = mustCredit || data.add_credits

    const { data: authorProfile } = await supabaseAdmin
      .from("profiles")
      .select("handle, display_name")
      .eq("id", original.author_id)
      .single()

    const base = `${original.title}-repost`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80)
    const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`

    const workspace_id = await ensureUserWorkspace(
      supabaseAdmin,
      context.userId!
    )

    const { data: repost, error: cErr } = await supabaseAdmin
      .from("content_objects")
      .insert({
        workspace_id,
        author_id: context.userId,
        title: `Repost · ${original.title}`,
        slug,
        summary: original.summary,
        reposted_from: original.id,
        status: "draft",
        visibility: "public",
      })
      .select("id, slug")
      .single()
    if (cErr || !repost) {
      console.error("[server]", cErr)
      throw new Error("Could not create repost")
    }

    const blocks: Array<Record<string, unknown>> = []
    if (credited && authorProfile) {
      blocks.push({
        content_object_id: repost.id,
        type: "callout",
        order: 0,
        content: {
          text: `Originally by @${authorProfile.handle} — "${original.title}"`,
          html: `<p>Originally by <a href="/u/${authorProfile.handle}/${original.slug}"><strong>@${authorProfile.handle}</strong></a> — <em>${original.title}</em></p>`,
        },
        semantic_role: "context",
      })
    }
    if (data.note?.trim()) {
      blocks.push({
        content_object_id: repost.id,
        type: "paragraph",
        order: blocks.length,
        content: { text: data.note.trim(), html: `<p>${data.note.trim()}</p>` },
      })
    }
    if (blocks.length) await supabaseAdmin.from("blocks").insert(blocks)

    await supabaseAdmin.from("reposts").insert({
      user_id: context.userId,
      original_piece_id: original.id,
      repost_piece_id: repost.id,
      credited,
    })

    return { id: repost.id, credited }
  }
  return await __handler({
    data: args?.data as {
      original_piece_id: string
      add_credits?: boolean
      note?: string | null
    },
    context,
  })
}

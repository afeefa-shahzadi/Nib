/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"
import { ensureUserWorkspace } from "./helpers"
import { checkRateLimit } from "@/lib/rate-limit.server"

// Titles, handles and notes come from users; never put them into stored HTML raw.
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
const MAX_NOTE = 2000

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
    const note = (data.note ?? "").trim()
    if (note.length > MAX_NOTE) throw new Error(`Keep the note under ${MAX_NOTE} characters.`)
    const rl = await checkRateLimit("repost", context.userId, 10, 3600)
    if (!rl.ok) throw new Error("You've reposted a lot this hour. Try again later.")
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
    if (original.author_id === context.userId) throw new Error("You can't repost your own piece")
    // One repost per piece per reader: hand back the existing draft instead of piling up copies.
    // The repost is recorded on the new piece itself (reposted_from).
    const { data: existing } = await supabaseAdmin
      .from("content_objects")
      .select("id")
      .eq("author_id", context.userId)
      .eq("reposted_from", original.id)
      .limit(1)
      .maybeSingle()
    if (existing) return { id: existing.id, credited: false, existing: true }
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
          html: `<p>Originally by <a href="/u/${encodeURIComponent(authorProfile.handle)}/${encodeURIComponent(original.slug)}"><strong>@${esc(authorProfile.handle)}</strong></a> — <em>${esc(original.title)}</em></p>`,
        },
        semantic_role: "context",
      })
    }
    if (note) {
      blocks.push({
        content_object_id: repost.id,
        type: "paragraph",
        order: blocks.length,
        content: { text: note, html: `<p>${esc(note)}</p>` },
      })
    }
    const { error: bErr } = blocks.length ? await supabaseAdmin.from("blocks").insert(blocks) : { error: null }
    if (bErr) {
      // Don't leave a half-built (possibly uncredited) draft behind.
      console.error("[repost]", bErr)
      await supabaseAdmin.from("content_objects").delete().eq("id", repost.id)
      throw new Error("Could not create repost")
    }

    return { id: repost.id, credited, existing: false }
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

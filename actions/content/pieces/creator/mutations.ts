/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { assertCanPost } from "@/lib/parental-consent"
import { normalizePiecePrice } from "@/lib/piece-price"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"
import { revalidatePath, updateTag } from "next/cache"
import { CO_COLS, slugify, ensureUserWorkspace } from "../../helpers"
import { assertNotRestricted } from "@/lib/restrictions"
import { inlineMarkdownToHtml, stripInlineMarkdown } from "@/lib/import/inline-markdown"

// ---------- CREATOR: create a new draft ----------
export async function createPiece(args: { data?: any } = {}) {
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
      title: string
      summary?: string | null
      canonical_thesis?: string | null
    }
    context: ActionContext
  }) => {
    const base = slugify(data.title) || "untitled"
    const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`
    const workspace_id = await ensureUserWorkspace(
      context.supabase,
      context.userId!
    )

    const { data: piece, error } = await context.supabase
      .from("content_objects")
      .insert({
        workspace_id,
        author_id: context.userId,
        title: data.title,
        slug,
        summary: data.summary ?? null,
        canonical_thesis: data.canonical_thesis ?? null,
      })
      .select(CO_COLS)
      .single()
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }

    // seed one paragraph block
    await context.supabase.from("blocks").insert({
      content_object_id: piece.id,
      order: 0,
      type: "paragraph",
      content: { text: "" },
      mode_visibility: ["skim", "standard", "expert", "teach", "debate"],
    })
    return piece
  }
  return await __handler({
    data: args?.data as {
      title: string
      summary?: string | null
      canonical_thesis?: string | null
    },
    context,
  })
}

// ---------- CREATOR: import markdown as a new draft ----------
export async function importMarkdown(args: { data?: any } = {}) {
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
    data: { title: string; markdown: string }
    context: ActionContext
  }) => {
    const base = slugify(data.title) || "imported"
    const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`
    const workspace_id = await ensureUserWorkspace(
      context.supabase,
      context.userId!
    )

    const { data: piece, error } = await context.supabase
      .from("content_objects")
      .insert({
        workspace_id,
        author_id: context.userId,
        title: data.title,
        slug,
      })
      .select(CO_COLS)
      .single()
    if (error || !piece) {
      console.error("[server]", error)
      throw new Error("Could not create draft.")
    }

    const lines = data.markdown.replace(/\r\n/g, "\n").split("\n")
    type Row = { type: string; content: Record<string, unknown> }
    const rows: Row[] = []
    let buf: string[] = []
    let inCode = false
    let codeLang = ""
    const textContent = (t: string) => {
      const html = inlineMarkdownToHtml(t)
      return html ? { text: stripInlineMarkdown(t), html } : { text: t }
    }
    const flushPara = () => {
      const text = buf.join("\n").trim()
      buf = []
      if (!text) return
      // Scene break (---, ***, ___): no divider block exists, so keep it as a
      // plain "* * *" paragraph instead of a literal row of dashes.
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(text)) {
        rows.push({ type: "paragraph", content: { text: "* * *" } })
        return
      }
      const h = /^(#{1,6})\s+(.*)$/.exec(text)
      if (h) {
        rows.push({
          type: "heading",
          // Editor supports only H2/H3 (the title is the H1): clamp # -> 2, #### and deeper -> 3.
          content: { text: h[2], level: Math.min(3, Math.max(2, h[1].length)) },
        })
        return
      }
      if (text.startsWith("> ")) {
        rows.push({
          type: "quote",
          content: textContent(text.replace(/^>\s?/gm, "")),
        })
        return
      }
      rows.push({ type: "paragraph", content: textContent(text) })
    }
    for (const raw of lines) {
      if (raw.startsWith("```")) {
        if (inCode) {
          rows.push({
            type: "code",
            content: { text: buf.join("\n"), lang: codeLang },
          })
          buf = []
          inCode = false
          codeLang = ""
        } else {
          flushPara()
          inCode = true
          codeLang = raw.slice(3).trim()
        }
        continue
      }
      if (inCode) {
        buf.push(raw)
        continue
      }
      if (raw.trim() === "") {
        flushPara()
        continue
      }
      buf.push(raw)
    }
    if (inCode)
      rows.push({
        type: "code",
        content: { text: buf.join("\n"), lang: codeLang },
      })
    else flushPara()

    if (rows.length === 0)
      rows.push({ type: "paragraph", content: { text: "" } })

    const insertRows = rows.slice(0, 500).map((r, idx) => ({
      content_object_id: piece.id,
      order: idx,
      type: r.type,
      content: r.content,
    }))

    const { error: bErr } = await context.supabase
      .from("blocks")
      .insert(insertRows)
    if (bErr) {
      console.error("[server]", bErr)
      throw new Error("Imported draft created, but blocks failed to save.")
    }
    return piece
  }
  return await __handler({
    data: args?.data as { title: string; markdown: string },
    context,
  })
}

// ---------- CREATOR: update piece meta ----------
export async function updatePiece(args: { data?: any } = {}) {
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
      id: string
      title?: string
      summary?: string | null
      canonical_thesis?: string | null
      tags?: string[]
      visibility?: "public" | "member" | "private"
      status?: "draft" | "scheduled" | "published" | "archived"
      scheduled_for?: string | null
      tips_enabled?: boolean
      sponsorship_enabled?: boolean
      repost_credits_required?: number
      is_nsfw?: boolean
      is_ai_generated?: boolean
      prose_only?: boolean
      curator_share_enabled?: boolean
      price_paise?: number | null
      cover_image_url?: string | null
      allow_inline_comments?: boolean
    }
    context: ActionContext
  }) => {
    const patch: Record<string, unknown> = {}
    for (const k of [
      "title",
      "summary",
      "canonical_thesis",
      "tags",
      "visibility",
      "status",
      "scheduled_for",
      "tips_enabled",
      "sponsorship_enabled",
      "repost_credits_required",
      "is_nsfw",
      "is_ai_generated",
      "prose_only",
      "curator_share_enabled",
      "cover_image_url",
      "allow_inline_comments",
    ] as const) {
      if (data[k] !== undefined) patch[k] = data[k]
    }
    if (data.price_paise !== undefined) patch.price_paise = normalizePiecePrice(data.price_paise)

    // Check if we are transitioning to published
    let isNewPublish = false
    let pieceDetails: {
      title: string
      summary: string | null
      slug: string
    } | null = null
    let authorDetails: { display_name: string; handle: string } | null = null

    if (data.status === "published") {
      await assertCanPost(context.userId!)
      // Reputation gate: a restricted creator cannot publish. restricted_until is
      // a service-role-only column; the user-scoped client reads null and the gate
      // silently opens, so check it with the true service role.
      await assertNotRestricted(
        await createServiceRoleClient(),
        context.userId!,
        "publish"
      )
      // Get current piece to see if it was already published
      const { data: currentPiece } = await context.supabase
        .from("content_objects")
        .select(
          "status, visibility, title, summary, slug, author:profiles!content_objects_author_id_profiles_id_fk(display_name, handle)"
        )
        .eq("id", data.id)
        .single()

      if (currentPiece && currentPiece.status !== "published") {
        isNewPublish = true
        patch.published_at = new Date().toISOString()
        // 'private' is the column default, never a deliberate choice in the
        // composer — publishing a private piece would 404 for every reader.
        // Default it to public; an explicit visibility in the patch wins.
        if (patch.visibility === undefined && currentPiece.visibility === "private") {
          patch.visibility = "public"
        }
        pieceDetails = currentPiece as any as {
          title: string
          summary: string | null
          slug: string
        }
        authorDetails = (
          Array.isArray(currentPiece.author)
            ? currentPiece.author[0]
            : currentPiece.author
        ) as { display_name: string; handle: string }
      }
    }

    const { data: updated, error } = await context.supabase
      .from("content_objects")
      .update(patch)
      .eq("id", data.id)
      .select("status")
      .maybeSingle()
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    if (data.status === "published") {
      const { tickQuest } = await import("@/lib/quests.server")
      await tickQuest(context.userId!, "publish_1")
    }

    if (isNewPublish && pieceDetails && authorDetails) {
      // Background async process to send emails
      ;(async () => {
        try {
          const { data: follows } = await context.supabase
            .from("follows")
            .select("follower_id")
            .eq("author_id", context.userId)

          const followerIds = (follows ?? []).map(
            (f: { follower_id: string }) => f.follower_id
          )

          if (followerIds.length > 0) {
            // notifications has no INSERT policy by design (system-written
            // only); the cookie client would be RLS-blocked writing rows for
            // other users, so use the service role.
            const { createServiceRoleClient } = await import(
              "@/lib/supabase/server"
            )
            const svc = await createServiceRoleClient()
            await svc.from("notifications").insert(
              followerIds.map((fid: string) => ({
                user_id: fid,
                type: "new_piece",
                payload: {
                  author_id: context.userId,
                  title: pieceDetails!.title,
                  slug: pieceDetails!.slug,
                },
              }))
            )

            // Followers + confirmed subscribers, minus unsubscribes. Must use
            // the service role — the resolver reads the RLS-locked suppression
            // list + auth.admin.listUsers, which the cookie client can't.
            const { getAuthorRecipientEmails } = await import(
              "@/lib/newsletter-recipients"
            )
            const recipientEmails = await getAuthorRecipientEmails(
              svc,
              context.userId!
            )

            if (recipientEmails.length > 0) {
              const { sendPublishEmail } = await import("@/lib/email")
              await sendPublishEmail({
                authorName: authorDetails.display_name,
                authorHandle: authorDetails.handle,
                authorId: context.userId!,
                pieceTitle: pieceDetails.title,
                pieceSummary: pieceDetails.summary || "",
                pieceSlug: pieceDetails.slug,
                recipientEmails,
              })
            }
          }
        } catch (err) {
          console.error("Failed to send notification emails:", err)
        }
      })()
    }

    // Public caches (discover feed, author profile, related) hold published
    // piece rows; draft autosaves leave them alone.
    if (data.status || updated?.status === "published") updateTag("public")
    return { ok: true }
  }
  return await __handler({
    data: args?.data as {
      id: string
      title?: string
      summary?: string | null
      canonical_thesis?: string | null
      tags?: string[]
      visibility?: "public" | "member" | "private"
      status?: "draft" | "scheduled" | "published" | "archived"
      scheduled_for?: string | null
      tips_enabled?: boolean
      sponsorship_enabled?: boolean
      repost_credits_required?: number
    },
    context,
  })
}

// ---------- CREATOR: delete piece ----------
export async function deletePiece(args: { data?: any } = {}) {
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
    data: { id: string }
    context: ActionContext
  }) => {
    const { error } = await context.supabase
      .from("content_objects")
      .delete()
      .eq("id", data.id)
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    revalidatePath("/", "layout")
    updateTag("public")
    return { ok: true }
  }
  return await __handler({ data: args?.data as { id: string }, context })
}

// ---------- CREATOR: bulk piece ops ----------
export async function bulkUpdatePieces(args: { data?: any } = {}) {
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
      ids: string[]
      patch: {
        status?: "draft" | "scheduled" | "published" | "archived" | "deleted"
        visibility?: "public" | "member" | "private"
        tags?: string[]
      }
    }
    context: ActionContext
  }) => {
    const patch: Record<string, unknown> = { ...data.patch }
    if (data.patch.status === "published") {
      await assertCanPost(context.userId!)
      // restricted_until is service-role-only; check the gate with the true
      // service role, not the user-scoped client (which reads null and opens it).
      await assertNotRestricted(
        await createServiceRoleClient(),
        context.userId!,
        "publish"
      )
      patch.published_at = new Date().toISOString()
      // Same default as updatePiece: publishing a default-'private' piece
      // would 404 publicly, so bulk-publish flips those rows to public
      // unless the caller chose a visibility.
      if (patch.visibility === undefined) {
        await context.supabase
          .from("content_objects")
          .update({ visibility: "public" })
          .in("id", data.ids)
          .eq("visibility", "private")
      }
    }

    const { error } = await context.supabase
      .from("content_objects")
      .update(patch)
      .in("id", data.ids)
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    revalidatePath("/", "layout")
    updateTag("public")
    return { ok: true }
  }
  return await __handler({
    data: args?.data as {
      ids: string[]
      patch: {
        status?: "draft" | "scheduled" | "published" | "archived" | "deleted"
        visibility?: "public" | "member" | "private"
        tags?: string[]
      }
    },
    context,
  })
}

// ---------- CREATOR: bulk delete pieces ----------
export async function bulkDeletePieces(args: { data?: any } = {}) {
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
    data: { ids: string[] }
    context: ActionContext
  }) => {
    // Manually cascade delete blocks
    await context.supabase.from("blocks").delete().in("content_object_id", data.ids)
    
    const { error } = await context.supabase
      .from("content_objects")
      .delete()
      .in("id", data.ids)
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    revalidatePath("/", "layout")
    updateTag("public")
    return { ok: true }
  }
  return await __handler({ data: args?.data as { ids: string[] }, context })
}

// ---------- COAUTHORS ----------
export async function addCoAuthor(args: { data?: any } = {}) {
  const supabase = await createClient()
  const { data: _auth } = await supabase.auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase,
  }
  const __handler = async ({
    data,
    context,
  }: {
    data: { pieceId: string; handle: string }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("handle", data.handle)
      .single()
    if (!profile) throw new Error("User not found")
    const { error } = await context.supabase
      .from("piece_coauthors")
      .insert({ piece_id: data.pieceId, user_id: profile.id })
    if (error) {
      if (error.code === "23505") throw new Error("Already a co-author")
      throw new Error("Failed to add co-author")
    }
    return true
  }
  return await __handler({
    data: args.data as { pieceId: string; handle: string },
    context,
  })
}

export async function removeCoAuthor(args: { data?: any } = {}) {
  const supabase = await createClient()
  const { data: _auth } = await supabase.auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase,
  }
  const __handler = async ({
    data,
    context,
  }: {
    data: { pieceId: string; userId: string }
    context: ActionContext
  }) => {
    const { error } = await context.supabase
      .from("piece_coauthors")
      .delete()
      .eq("piece_id", data.pieceId)
      .eq("user_id", data.userId)
    if (error) throw new Error("Failed to remove co-author")
    return true
  }
  return await __handler({
    data: args.data as { pieceId: string; userId: string },
    context,
  })
}

import { z } from "zod"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { SupabaseClient } from "@supabase/supabase-js"
import { isLaunchFree } from "@/lib/plan"

// Explicit column list excludes search_tsv (tsvector, not serializable)
export const CO_COLS =
  "id, author_id, title, slug, summary, canonical_thesis, status, visibility, tags, scheduled_for, published_at, created_at, updated_at, tips_enabled, sponsorship_enabled, repost_credits_required, reposted_from, is_nsfw, is_ai_generated, prose_only, curator_share_enabled, allow_inline_comments, cover_image_url, source_url, price_paise" as const

// Resolve viewer user id (if any) from current session, without throwing.
export async function tryGetViewerId(): Promise<string | null> {
  try {
    const { data, error } = await (await createClient()).auth.getUser()
    if (error || !data.user) return null
    return data.user.id
  } catch {
    return null
  }
}

// A piece is viewable when it is published and public, or the viewer wrote it.
// Published members-only pieces count for members (open to all during launch).
// Admin-client reads bypass RLS, so every reader-facing path checks this.
export async function isPieceViewable(
  piece: { status: string | null; visibility: string | null; author_id: string } | null,
  viewerId: string | null | undefined
): Promise<boolean> {
  if (!piece) return false
  if (viewerId && piece.author_id === viewerId) return true
  if (piece.status !== "published") return false
  if (piece.visibility === "public") return true
  return (
    piece.visibility === "member" &&
    (await viewerHasAuthorAccess(viewerId ?? null, piece.author_id))
  )
}

// Loads a piece's access fields and returns it only if the viewer may see it.
export async function getViewablePiece(
  admin: SupabaseClient,
  pieceId: string,
  viewerId: string | null | undefined
): Promise<{ id: string; status: string; visibility: string; author_id: string } | null> {
  const { data } = await admin
    .from("content_objects")
    .select("id, status, visibility, author_id")
    .eq("id", pieceId)
    .maybeSingle()
  return (await isPieceViewable(data, viewerId)) ? data : null
}

// Blanks monetization-gated block content when the viewer lacks access.
export function gateBlocks<T extends { monetization_eligible?: boolean; content: unknown }>(
  blocks: T[],
  hasAccess: boolean
): T[] {
  return blocks.map((b) => (b.monetization_eligible && !hasAccess ? { ...b, content: {} } : b))
}

// Does viewer have access to monetization-gated blocks? An active membership
// opens every piece by the author; a paid piece purchase opens only that piece,
// and a paid bundle opens the pieces in it.
export async function viewerHasAuthorAccess(
  viewerId: string | null,
  authorId: string,
  contentObjectId?: string
): Promise<boolean> {
  if (isLaunchFree()) return true
  if (!viewerId) return false
  if (viewerId === authorId) return true
  const admin = await createAdminClient()
  const [{ data: mem }, pur, bun] = await Promise.all([
    admin
      .from("memberships")
      .select("id")
      .eq("user_id", viewerId)
      .eq("author_id", authorId)
      .eq("status", "active")
      .limit(1),
    contentObjectId
      ? admin
          .from("purchases")
          .select("id")
          .eq("user_id", viewerId)
          .eq("content_object_id", contentObjectId)
          .eq("kind", "piece")
          .eq("status", "paid")
          .limit(1)
      : Promise.resolve({ data: [] }),
    contentObjectId ? boughtInBundle(admin, viewerId, authorId, contentObjectId) : false,
  ])
  return (mem?.length ?? 0) > 0 || (pur.data?.length ?? 0) > 0 || bun
}

// Is this piece in a bundle the viewer bought from its author? A bundle can
// hold other writers' pieces; buying it never unlocks theirs.
async function boughtInBundle(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  viewerId: string,
  authorId: string,
  contentObjectId: string
) {
  const { data: inBundles } = await admin
    .from("bundle_items")
    .select("bundle_id")
    .eq("content_object_id", contentObjectId)
  const ids = (inBundles ?? []).map((r) => r.bundle_id as string)
  if (!ids.length) return false
  const { data } = await admin
    .from("purchases")
    .select("id")
    .eq("user_id", viewerId)
    .in("bundle_id", ids)
    .eq("author_id", authorId)
    .eq("kind", "bundle")
    .eq("status", "paid")
    .limit(1)
  return (data?.length ?? 0) > 0
}

export const ReadingMode = z.enum([
  "skim",
  "standard",
  "expert",
  "teach",
  "debate",
])
export type ReadingMode = z.infer<typeof ReadingMode>

export const BlockType = z.enum([
  "paragraph",
  "heading",
  "citation",
  "code",
  "callout",
  "question",
  "quote",
  "image",
  "chart",
  "exercise",
  "audio_note",
])
export const Visibility = z.enum(["public", "member", "private"])
export const Status = z.enum(["draft", "scheduled", "published", "archived"])

export const ModeVisibility = z.object({
  skim: z.boolean(),
  standard: z.boolean(),
  expert: z.boolean(),
  teach: z.boolean(),
  debate: z.boolean(),
})

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80)
}

export async function ensureUserWorkspace(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: wm } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()

  if (wm?.workspace_id) return wm.workspace_id

  const slug = `ws-${Math.random().toString(36).slice(2, 8)}`
  const { data: ws, error: wsErr } = await supabase
    .from("workspaces")
    .insert({
      owner_id: userId,
      name: "Personal Workspace",
      slug,
    })
    .select("id")
    .single()

  if (wsErr || !ws) throw new Error("Could not create personal workspace")

  const { error: wmErr } = await supabase.from("workspace_members").insert({
    workspace_id: ws.id,
    user_id: userId,
    role: "owner",
  })

  if (wmErr) throw new Error("Could not assign workspace to user")

  return ws.id
}

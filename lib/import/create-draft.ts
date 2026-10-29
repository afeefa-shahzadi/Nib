import type { SupabaseClient } from "@supabase/supabase-js"
import { CO_COLS, slugify, ensureUserWorkspace } from "@/actions/content/helpers"
import type { ImportedBlock } from "./html-to-blocks"

// Create a draft content_object + its blocks from parsed import rows. Shared by
// every importer (zip, url). Mirrors the insert importMarkdown does — kept here
// so the import route and any future source reuse one code path.
export async function createDraftWithBlocks(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  rows: ImportedBlock[],
  sourceUrl?: string | null
): Promise<{ id: string; slug: string; title: string }> {
  const cleanTitle = (title || "Untitled").trim().slice(0, 300) || "Untitled"
  const base = slugify(cleanTitle) || "imported"
  const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`
  const workspace_id = await ensureUserWorkspace(supabase, userId)

  const { data: piece, error } = await supabase
    .from("content_objects")
    .insert({ workspace_id, author_id: userId, title: cleanTitle, slug, source_url: sourceUrl || null })
    .select(CO_COLS)
    .single()
  if (error || !piece) {
    console.error("[import] create draft failed:", error)
    throw new Error("Could not create draft.")
  }

  // Cap at 500 blocks/piece (same as importMarkdown) to bound a pathological
  // import; drop empty rows so a sparse source doesn't create blank blocks.
  const kept = rows.filter((r) => r.type !== "paragraph" || r.content.text || r.content.html)
  const safe = (kept.length ? kept : [{ type: "paragraph", content: { text: "", html: "" } }]).slice(0, 500)
  const insertRows = safe.map((r, idx) => ({
    content_object_id: piece.id,
    order: idx,
    type: r.type,
    content: r.content,
  }))

  const { error: bErr } = await supabase.from("blocks").insert(insertRows)
  if (bErr) {
    console.error("[import] block insert failed:", bErr)
    throw new Error("Draft created, but its blocks failed to save.")
  }
  return { id: piece.id, slug: piece.slug, title: piece.title }
}

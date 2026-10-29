import JSZip from "jszip"
import { htmlToBlocks, extractTitle, extractCanonical, type ImportedBlock } from "./html-to-blocks"

export type ImportedPost = {
  title: string
  blocks: ImportedBlock[]
  publishedAt?: string | null
  isPublished: boolean
  sourceFile: string
  sourceUrl?: string | null
}

export type ParsedExport = {
  source: "substack" | "medium" | "generic"
  posts: ImportedPost[]
}

// Minimal RFC-4180-ish CSV parser (handles quoted fields, escaped quotes, and
// newlines inside quotes — Substack's posts.csv has all three).
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ""
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ",") { cur.push(field); field = "" }
    else if (c === "\n") { cur.push(field); field = ""; rows.push(cur); cur = [] }
    else if (c !== "\r") field += c
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur) }
  const header = rows.shift()?.map((h) => h.trim().toLowerCase()) ?? []
  return rows
    .filter((r) => r.some((v) => v.trim()))
    .map((r) => {
      const o: Record<string, string> = {}
      header.forEach((h, i) => (o[h] = r[i] ?? ""))
      return o
    })
}

function filenameTitle(name: string): string {
  const base = name.split("/").pop()!.replace(/\.html?$/i, "")
  return base
    .replace(/^draft_/i, "")
    .replace(/^\d{4}-\d{2}-\d{2}[_-]/, "") // medium date prefix
    .replace(/[-_]+[0-9a-f]{6,}$/i, "") // trailing hash
    .replace(/[-_]+/g, " ")
    .trim()
}

export async function parseExportZip(
  buffer: ArrayBuffer | Buffer | Uint8Array
): Promise<ParsedExport> {
  const zip = await JSZip.loadAsync(buffer)
  const files = Object.values(zip.files).filter((f) => !f.dir)
  const htmlEntries = files.filter((f) => /\.html?$/i.test(f.name))
  const csvEntry = files.find((f) => /(^|\/)posts\.csv$/i.test(f.name))

  // ----- Substack: posts.csv carries title / published / date, keyed by id -----
  if (csvEntry) {
    const csv = parseCsv(await csvEntry.async("string"))
    const posts: ImportedPost[] = []
    for (const entry of htmlEntries) {
      const html = await entry.async("string")
      const base = entry.name.split("/").pop()!.replace(/\.html?$/i, "")
      const postId = base.split(".")[0]
      const meta =
        csv.find((r) => (r.post_id || r.id || "") === postId) || {}
      const title = (meta.title || extractTitle(html) || filenameTitle(entry.name) || "Imported post").trim()
      const blocks = htmlToBlocks(html)
      if (blocks.length === 0) continue
      posts.push({
        title,
        blocks,
        publishedAt: meta.post_date || meta.date || null,
        isPublished: /^(true|yes|1)$/i.test((meta.is_published || meta.published || "").trim()),
        sourceFile: entry.name,
        sourceUrl: extractCanonical(html) || (meta.canonical_url || "").trim() || null,
      })
    }
    return { source: "substack", posts }
  }

  // ----- Medium / generic: title + draft flag inferred from file + markup -----
  const isMedium = htmlEntries.some((f) => /(^|\/)posts\//i.test(f.name))
  const posts: ImportedPost[] = []
  for (const entry of htmlEntries) {
    const html = await entry.async("string")
    const base = entry.name.split("/").pop()!
    const title = (extractTitle(html) || filenameTitle(entry.name) || "Imported post").trim()
    const blocks = htmlToBlocks(html)
    if (blocks.length === 0) continue
    const isDraft = /(^|\/)draft_/i.test(entry.name) || /^draft_/i.test(base)
    // Drop a leading heading that just repeats the title (Medium's h1.p-name).
    if (blocks[0]?.type === "heading" && (blocks[0].content.text as string)?.trim() === title) {
      blocks.shift()
    }
    posts.push({ title, blocks, isPublished: !isDraft, sourceFile: entry.name, sourceUrl: extractCanonical(html) })
  }
  return { source: isMedium ? "medium" : "generic", posts }
}

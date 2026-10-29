import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { parseExportZip } from "@/lib/import/export-zip"
import { htmlToBlocks, extractTitle } from "@/lib/import/html-to-blocks"
import { createDraftWithBlocks } from "@/lib/import/create-draft"
import { rehostImages } from "@/lib/import/rehost-images"
import { isPrivateHost, safeFetch } from "@/lib/import/ssrf"

// Import pieces from a Substack/Medium export zip, or a single article URL, into
// drafts. The migration on-ramp: removes the switching friction that otherwise
// kills adoption.
export const dynamic = "force-dynamic"
// ponytail: creates drafts sequentially within one request. Fine for a personal
// export (tens–low-hundreds of posts); move to a background job if it ever times
// out on a huge archive.
export const maxDuration = 60

const MAX_ZIP = 25 * 1024 * 1024 // 25 MB
// ponytail: caps the page fetch when the server sends content-length (static
// article pages do). A chunked response without the header slips through — add
// streaming truncation only if that becomes a real abuse vector.
const MAX_PAGE_BYTES = 8 * 1024 * 1024 // 8 MB

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Sign in to import." }, { status: 401 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: "Invalid request." }, { status: 400 })

  const url = (form.get("url") as string | null)?.trim()
  const file = form.get("file")

  // ----- Single article URL -----
  if (url) {
    let u: URL
    try {
      u = new URL(url)
    } catch {
      return NextResponse.json({ error: "Enter a valid URL." }, { status: 400 })
    }
    if (!/^https?:$/.test(u.protocol) || isPrivateHost(u.hostname)) {
      return NextResponse.json({ error: "That URL can't be imported." }, { status: 400 })
    }
    const isMedium = /(^|\.)medium\.com$/i.test(u.hostname)
    let html: string
    try {
      const res = await safeFetch(u.toString(), {
        headers: { "user-agent": "NibImporter/1.0" },
      })
      const len = Number(res.headers.get("content-length") || 0)
      if (len > MAX_PAGE_BYTES)
        return NextResponse.json({ error: "That page is too large to import." }, { status: 413 })
      if (!res.ok) {
        // Medium (and some Substack custom domains) sit behind Cloudflare and
        // 403 a server fetch. The export zip is the reliable path for those.
        if (isMedium || res.status === 403)
          return NextResponse.json(
            { error: "This site blocks direct URL import. On Medium: Settings → Download your information, then upload the .zip here. (Substack: Settings → Exports.)" },
            { status: 400 }
          )
        return NextResponse.json({ error: `Could not fetch that page (${res.status}).` }, { status: 400 })
      }
      html = await res.text()
    } catch {
      return NextResponse.json({ error: "Could not reach that URL." }, { status: 400 })
    }
    const blocks = htmlToBlocks(html)
    if (blocks.length === 0)
      return NextResponse.json({ error: "No readable content found at that URL." }, { status: 422 })
    try {
      const svc = await createServiceRoleClient()
      await rehostImages(blocks, user.id, svc)
      const draft = await createDraftWithBlocks(supabase, user.id, extractTitle(html) || u.hostname, blocks, u.toString())
      return NextResponse.json({ created: 1, source: "url", drafts: [draft] })
    } catch {
      return NextResponse.json({ error: "Could not create the draft." }, { status: 500 })
    }
  }

  // ----- Export zip (Substack / Medium) -----
  if (file && typeof file !== "string") {
    if (file.size > MAX_ZIP)
      return NextResponse.json({ error: "File too large (max 25 MB)." }, { status: 413 })
    let parsed
    try {
      parsed = await parseExportZip(Buffer.from(await file.arrayBuffer()))
    } catch {
      return NextResponse.json({ error: "Couldn't read that file. Upload the .zip from your export." }, { status: 400 })
    }
    if (parsed.posts.length === 0)
      return NextResponse.json({ error: "No posts found in that export.", source: parsed.source }, { status: 422 })

    const svc = await createServiceRoleClient()
    const drafts: { id: string; slug: string; title: string }[] = []
    for (const post of parsed.posts.slice(0, 200)) {
      try {
        await rehostImages(post.blocks, user.id, svc)
        drafts.push(await createDraftWithBlocks(supabase, user.id, post.title, post.blocks, post.sourceUrl))
      } catch (e) {
        console.error("[import] draft failed:", post.sourceFile, e)
      }
    }
    return NextResponse.json({ created: drafts.length, source: parsed.source, drafts })
  }

  return NextResponse.json({ error: "Provide a .zip export or a URL." }, { status: 400 })
}

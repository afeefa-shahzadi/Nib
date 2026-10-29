import { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { excludeNsfw } from "@/lib/nsfw"

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function wrap(s: string, maxChars: number, maxLines: number): string[] {
  const words = s.split(/\s+/)
  const lines: string[] = []
  let line = ""
  for (const w of words) {
    if ((line + " " + w).trim().length > maxChars) {
      if (line) lines.push(line)
      line = w
      if (lines.length >= maxLines) break
    } else {
      line = (line + " " + w).trim()
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  if (
    lines.length === maxLines &&
    words.join(" ").length > lines.join(" ").length
  ) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S+$/, "") + "…"
  }
  return lines
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ handle: string; slug: string }> }
) {
  const { handle, slug } = await params
  const supabaseAdmin = await createAdminClient()

  const { data: author } = await supabaseAdmin
    .from("profiles")
    .select("id, handle, display_name")
    .eq("handle", handle)
    .maybeSingle()
  if (!author) return new Response("Not found", { status: 404 })

  // NSFW pieces get no OG preview (title/summary would leak into embeds).
  const { data: piece } = await excludeNsfw(
    supabaseAdmin
      .from("content_objects")
      .select("title, summary")
      .eq("author_id", author.id)
      .eq("slug", slug)
      .eq("status", "published")
      .eq("visibility", "public")
  ).maybeSingle()
  if (!piece) return new Response("Not found", { status: 404 })

  const titleLines = wrap(piece.title, 32, 3)
  const summaryLines = piece.summary ? wrap(piece.summary, 60, 2) : []

  const W = 1200,
    H = 630
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a0f"/>
      <stop offset="100%" stop-color="#1a1530"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="0" y="0" width="6" height="${H}" fill="#8b5cf6"/>
  <text x="80" y="120" font-family="Georgia, serif" font-size="22" fill="#8b5cf6" letter-spacing="6">NIB</text>
  ${titleLines
    .map(
      (l, i) =>
        `<text x="80" y="${230 + i * 78}" font-family="Georgia, serif" font-size="68" font-weight="700" fill="#f5f5f5">${esc(l)}</text>`
    )
    .join("\n  ")}
  ${summaryLines
    .map(
      (l, i) =>
        `<text x="80" y="${520 + i * 36}" font-family="-apple-system, system-ui, sans-serif" font-size="26" fill="#a3a3a3">${esc(l)}</text>`
    )
    .join("\n  ")}
  <text x="80" y="${H - 40}" font-family="-apple-system, system-ui, sans-serif" font-size="24" fill="#8b5cf6">@${esc(author.handle)}</text>
  <text x="${W - 80}" y="${H - 40}" text-anchor="end" font-family="-apple-system, system-ui, sans-serif" font-size="22" fill="#737373">${esc(author.display_name)}</text>
</svg>`

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  })
}

import { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { excludeNsfw } from "@/lib/nsfw"

const esc = (s: string) => s.replace(/]]>/g, "]]]]><![CDATA[>")

// One writer's public pieces as RSS 2.0, newest first.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const db = await createAdminClient()
  const { data: author } = await db
    .from("profiles")
    .select("id, handle, display_name, bio")
    .eq("handle", handle)
    .maybeSingle()
  if (!author) return new Response("Not found", { status: 404 })

  const { data: pieces } = await excludeNsfw(
    db
      .from("content_objects")
      .select("title, summary, slug, published_at, is_nsfw")
      .eq("author_id", author.id)
      .eq("status", "published")
      .eq("visibility", "public")
      .order("published_at", { ascending: false })
      .limit(50)
  )

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const profile = `${base}/u/${author.handle}`
  const items = (pieces ?? [])
    .map((p: { title: string; summary: string | null; slug: string; published_at: string | null }) => {
      const url = `${profile}/${p.slug}`
      return `
    <item>
      <title><![CDATA[${esc(p.title)}]]></title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${new Date(p.published_at ?? Date.now()).toUTCString()}</pubDate>
      <description><![CDATA[${esc(p.summary ?? "")}]]></description>
    </item>`
    })
    .join("")

  const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title><![CDATA[${esc(author.display_name)} on Nib]]></title>
    <link>${profile}</link>
    <description><![CDATA[${esc(author.bio ?? `New pieces by ${author.display_name}`)}]]></description>${items}
  </channel>
</rss>`

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}

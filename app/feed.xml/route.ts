import { createAdminClient } from "@/lib/supabase/server"
import { excludeNsfw } from "@/lib/nsfw"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createAdminClient()

  const { data: pieces } = await excludeNsfw(
    supabase
      .from("content_objects")
      .select(
        "title, summary, slug, published_at, profiles!inner(handle, display_name)"
      )
      .eq("status", "published")
      .eq("visibility", "public")
      .order("published_at", { ascending: false })
      .limit(50)
  )

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  // profiles!inner is a to-one embed (object, not array); mirror app/sitemap.ts.
  // Drop any piece still missing a handle rather than emit /u/undefined/<slug>.
  type Prof = { handle: string; display_name: string }
  const items = (pieces || [])
    .map((piece: { title: string, slug: string, published_at: string | null, summary: string | null, profiles: Prof | Prof[] }) => {
      const prof = Array.isArray(piece.profiles) ? piece.profiles[0] : piece.profiles
      return { piece, prof }
    })
    .filter(({ prof }: { prof?: Prof }) => Boolean(prof?.handle))
    .map(({ piece, prof }: { piece: { title: string, slug: string, published_at: string | null, summary: string | null }, prof?: Prof }) => `
    <item>
      <title><![CDATA[${piece.title}]]></title>
      <link>${baseUrl}/u/${prof?.handle}/${piece.slug}</link>
      <guid>${baseUrl}/u/${prof?.handle}/${piece.slug}</guid>
      <pubDate>${piece.published_at ? new Date(piece.published_at).toUTCString() : new Date().toUTCString()}</pubDate>
      <description><![CDATA[${piece.summary || ""}]]></description>
      <author>${prof?.display_name}</author>
    </item>
  `
    )
    .join("")

  const rss = `<?xml version="1.0" encoding="UTF-8" ?>
  <rss version="2.0">
    <channel>
      <title>Nib Feed</title>
      <link>${baseUrl}</link>
      <description>Latest pieces from Nib</description>
      ${items}
    </channel>
  </rss>`

  return new Response(rss, {
    headers: {
      "Content-Type": "text/xml",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}

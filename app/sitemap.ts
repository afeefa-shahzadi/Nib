import { MetadataRoute } from "next"
import { createAdminClient } from "@/lib/supabase/server"
import { excludeNsfw } from "@/lib/nsfw"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createAdminClient()

  // Get all published pieces
  const { data: pieces } = await excludeNsfw(
    supabase
      .from("content_objects")
      .select("slug, published_at, profiles!inner(handle)")
      .eq("status", "published")
      .eq("visibility", "public")
  )

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "")

  // profiles!inner is a to-one embed: PostgREST returns it as an object, not an
  // array. The old `profiles[0]?.handle` indexed that object and got undefined,
  // emitting /u/undefined/<slug> for every piece. Handle both shapes; drop any
  // entry still missing a handle rather than publish a broken canonical URL.
  const authored = (pieces || [])
    .map((piece: { slug: string; published_at: string | null; profiles: { handle: string } | { handle: string }[] }) => {
      const prof = piece.profiles
      const handle = Array.isArray(prof) ? prof[0]?.handle : prof?.handle
      return { handle, slug: piece.slug, published_at: piece.published_at }
    })
    .filter((p): p is { handle: string; slug: string; published_at: string | null } => Boolean(p.handle))

  const pieceEntries = authored.map((p) => ({
      url: `${baseUrl}/u/${p.handle}/${p.slug}`,
      lastModified: p.published_at ? new Date(p.published_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))

  // One profile page per author with a public piece.
  const profileEntries = [...new Set(authored.map((p) => p.handle))].map((handle) => ({
    url: `${baseUrl}/u/${handle}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }))

  const staticPages = ["/product", "/pricing", "/docs", "/leaderboard", "/terms", "/privacy"].map((path) => ({
    url: `${baseUrl}${path}`,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }))

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...staticPages,
    ...profileEntries,
    ...pieceEntries,
  ]
}

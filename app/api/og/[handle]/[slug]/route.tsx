import { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { excludeNsfw } from "@/lib/nsfw"
import { ogCard } from "@/lib/og-card"

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

  return ogCard({ title: piece.title, subtitle: piece.summary, footer: `${author.display_name} · @${author.handle}` })
}

/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient } from "@/lib/supabase/server"
import { excludeNsfw } from "@/lib/nsfw"
import { embed } from "ai"
import { createMistral } from "@ai-sdk/mistral"

// Full-text search across published pieces. Uses Postgres tsvector index
// (search_tsv) built from title/summary/thesis/tags. Falls back to ilike if
// the query is too short to FTS effectively.
export async function searchPieces(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()

  const __handler = async ({ data }: { data: { q: string } }) => {
    const q = data.q.trim()
    if (!q) return []

    // Build a tsquery-safe string: split on whitespace, sanitize, OR-join with :*
    const tsq = q
      .split(/\s+/)
      .map((t: string) => t.replace(/[^a-zA-Z0-9_-]/g, ""))
      .filter((t: string) => t.length > 0)
      .map((t: string) => `${t}:*`)
      .join(" & ")

    let rows: Array<{
      id: string
      title: string
      slug: string
      summary: string | null
      author_id: string
      published_at: string | null
    }> = []

    if (tsq) {
      const { data: ftsData, error } = await excludeNsfw(
        supabaseAdmin
          .from("content_objects")
          .select("id, title, slug, summary, author_id, published_at")
          .eq("status", "published")
          .eq("visibility", "public")
      )
        .textSearch("search_tsv", tsq, { config: "english" })
        .order("published_at", { ascending: false })
        .limit(30)
      if (!error && ftsData) rows = ftsData
    }

    // Fallback / supplement with ilike on title
    if (rows.length < 10) {
      const { data: ilikeData } = await excludeNsfw(
        supabaseAdmin
          .from("content_objects")
          .select("id, title, slug, summary, author_id, published_at")
          .eq("status", "published")
          .eq("visibility", "public")
      )
        .ilike("title", `%${q.replace(/[%_]/g, "")}%`)
        .order("published_at", { ascending: false })
        .limit(30)
      const seen = new Set(rows.map((r: { id: string }) => r.id))
      for (const r of ilikeData ?? []) if (!seen.has(r.id)) rows.push(r)
    }

    const authorIds = Array.from(
      new Set(rows.map((r: { author_id: string }) => r.author_id))
    )
    const { data: authors } = authorIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, handle, display_name")
          .in("id", authorIds)
      : { data: [] as { id: string; handle: string; display_name: string }[] }
    const amap = new Map(
      (authors ?? []).map(
        (a: { id: string; handle: string | null; display_name: string }) => [
          a.id,
          a,
        ]
      )
    )

    return rows.map(
      (r: {
        id: string
        title: string
        slug: string
        summary: string | null
        author_id: string
        published_at: string | null
      }) => ({
        ...r,
        author: amap.get(r.author_id) ?? null,
      })
    )
  }
  return await __handler({ data: args?.data as { q: string } })
}

// Semantic search across all blocks using Mistral embeddings and pgvector
export async function semanticSearchBlocks(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()

  const __handler = async ({ data }: { data: { q: string } }) => {
    const q = data.q.trim()
    if (!q) return []

    const key = process.env.MISTRAL_API_KEY
    if (!key) throw new Error("AI is not configured. Add MISTRAL_API_KEY.")

    const mistral = createMistral({ apiKey: key })

    // Generate embedding for the search query
    const { embedding } = await embed({
      model: mistral.embedding("mistral-embed"),
      value: q,
    })

    // Perform vector search via RPC
    const { data: blocks, error } = await supabaseAdmin.rpc("match_blocks", {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 15,
    })

    if (error || !blocks) {
      console.error("[search] Vector search failed:", error)
      return []
    }

    // Fetch the parent pieces for context
    const pieceIds = Array.from(
      new Set(
        blocks.map((b: { content_object_id: string }) => b.content_object_id)
      )
    )
    const { data: pieces } = pieceIds.length
      ? await excludeNsfw(
          supabaseAdmin
            .from("content_objects")
            .select("id, title, slug, author_id")
            .in("id", pieceIds)
            .eq("status", "published")
            .eq("visibility", "public")
        )
      : { data: [] }

    const pmap = new Map((pieces ?? []).map((p: { id: string }) => [p.id, p]))

    return blocks
      .map((b: { content_object_id: string; [key: string]: any }) => ({
        ...b,
        piece: pmap.get(b.content_object_id) ?? null,
      }))
      .filter((b: { piece: any }) => b.piece !== null)
  }
  return await __handler({ data: args?.data as { q: string } })
}

// Search for creator profiles (used for Network endorsements)
export async function searchProfiles(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()

  const __handler = async ({ data }: { data: { q: string } }) => {
    // Commas, brackets and wildcards would break or widen the .or() filter.
    const q = data.q.trim().replace(/[,()%*_\\]/g, " ").trim()
    if (!q) return []

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, handle, display_name, avatar_url, bio, content_objects!inner(id)"
      )
      .eq("content_objects.status", "published")
      .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(10)

    // Strip out the content_objects field from the response
    return (profiles || []).map((p) => ({
      id: p.id,
      handle: p.handle,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      bio: p.bio,
    }))
  }
  return await __handler({ data: args?.data as { q: string } })
}

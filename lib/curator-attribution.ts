import type { SupabaseClient } from "@supabase/supabase-js"

// A sale earns a curator share only when the buyer came from a public
// collection that really contains the piece, the author opted the piece in,
// and the curator isn't the author or the buyer. Anything else: no curator.
export async function resolveCuratorAttribution(
  db: SupabaseClient,
  args: { collectionId?: string | null; contentObjectId?: string | null; authorId: string; buyerId: string }
): Promise<{ collectionId: string; curatorId: string } | null> {
  const { collectionId, contentObjectId, authorId, buyerId } = args
  if (!collectionId || !contentObjectId) return null

  const [{ data: collection }, { data: item }, { data: piece }] = await Promise.all([
    db.from("collections").select("curator_id, is_public").eq("id", collectionId).maybeSingle(),
    db
      .from("collection_items")
      .select("id")
      .eq("collection_id", collectionId)
      .eq("content_object_id", contentObjectId)
      .maybeSingle(),
    db.from("content_objects").select("author_id, curator_share_enabled").eq("id", contentObjectId).maybeSingle(),
  ])

  const curatorId = collection?.curator_id as string | undefined
  if (!collection?.is_public || !item || !curatorId) return null
  if (!piece?.curator_share_enabled || piece.author_id !== authorId) return null
  if (curatorId === authorId || curatorId === buyerId) return null
  return { collectionId, curatorId }
}

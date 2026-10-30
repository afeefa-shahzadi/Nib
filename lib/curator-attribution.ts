import type { SupabaseClient } from "@supabase/supabase-js"

// A sale earns a curator share only when the buyer came from a public
// collection, the curator isn't the author or the buyer, and:
//   piece:  the collection contains the piece and the author opted it in;
//   bundle: the bundle is the author's and the collection contains at least
//           one of its pieces that the author opted in.
// Anything else: no curator.
export async function resolveCuratorAttribution(
  db: SupabaseClient,
  args: {
    collectionId?: string | null
    contentObjectId?: string | null
    bundleId?: string | null
    authorId: string
    buyerId: string
  }
): Promise<{ collectionId: string; curatorId: string } | null> {
  const { collectionId, contentObjectId, bundleId, authorId, buyerId } = args
  if (!collectionId || (!contentObjectId && !bundleId)) return null

  const { data: collection } = await db
    .from("collections")
    .select("curator_id, is_public")
    .eq("id", collectionId)
    .maybeSingle()
  const curatorId = collection?.curator_id as string | undefined
  if (!collection?.is_public || !curatorId) return null
  if (curatorId === authorId || curatorId === buyerId) return null

  const ok = contentObjectId
    ? await pieceReferred(db, collectionId, contentObjectId, authorId)
    : await bundleReferred(db, collectionId, bundleId!, authorId)
  return ok ? { collectionId, curatorId } : null
}

async function pieceReferred(db: SupabaseClient, collectionId: string, pieceId: string, authorId: string) {
  const [{ data: item }, { data: piece }] = await Promise.all([
    db
      .from("collection_items")
      .select("id")
      .eq("collection_id", collectionId)
      .eq("content_object_id", pieceId)
      .maybeSingle(),
    db.from("content_objects").select("author_id, curator_share_enabled").eq("id", pieceId).maybeSingle(),
  ])
  return !!item && !!piece?.curator_share_enabled && piece.author_id === authorId
}

async function bundleReferred(db: SupabaseClient, collectionId: string, bundleId: string, authorId: string) {
  const [{ data: bundle }, { data: items }] = await Promise.all([
    db.from("bundles").select("author_id").eq("id", bundleId).maybeSingle(),
    db.from("bundle_items").select("content_object_id").eq("bundle_id", bundleId),
  ])
  if (bundle?.author_id !== authorId) return false
  const ids = (items ?? []).map((i) => i.content_object_id).filter(Boolean) as string[]
  if (!ids.length) return false
  const { data: inCollection } = await db
    .from("collection_items")
    .select("content_object_id")
    .eq("collection_id", collectionId)
    .in("content_object_id", ids)
  const shared = (inCollection ?? []).map((i) => i.content_object_id as string)
  if (!shared.length) return false
  const { data: optedIn } = await db
    .from("content_objects")
    .select("id")
    .in("id", shared)
    .eq("author_id", authorId)
    .eq("curator_share_enabled", true)
  return (optedIn?.length ?? 0) > 0
}

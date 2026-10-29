// NSFW risk guards (docs/legal-payments-risk.md, docs/moderation-plan.md §2.A/§3.5).
// Razorpay prohibits adult content — NSFW pieces must never be monetized through
// the platform merchant account, and must never surface in public discovery.
import { SupabaseClient } from "@supabase/supabase-js"

const NOT_MONETIZABLE = "This content is not eligible for monetization."

// Call before creating any Razorpay order against a specific piece
// (tips, boosts, piece purchases, sponsorships).
export async function assertMonetizable(
  supabase: SupabaseClient,
  contentObjectId: string
) {
  const { data } = await supabase
    .from("content_objects")
    .select("is_nsfw")
    .eq("id", contentObjectId)
    .maybeSingle()
  if (!data) throw new Error("Piece not found")
  if (data.is_nsfw) throw new Error(NOT_MONETIZABLE)
}

// Same rule for bundles: one NSFW item poisons the whole bundle.
export async function assertBundleMonetizable(
  supabase: SupabaseClient,
  bundleId: string
) {
  const { data: items } = await supabase
    .from("bundle_items")
    .select("content_object_id")
    .eq("bundle_id", bundleId)
  const ids = (items ?? []).map(
    (i: { content_object_id: string }) => i.content_object_id
  )
  if (ids.length === 0) return
  const { count } = await supabase
    .from("content_objects")
    .select("id", { count: "exact", head: true })
    .in("id", ids)
    .eq("is_nsfw", true)
  if (count) throw new Error(NOT_MONETIZABLE)
}

// Apply to every content_objects query feeding a public discovery surface
// (search, trending/explore, RSS, sitemap, OG, public listings). §3.5: the
// exclusion is unconditional — viewer NSFW opt-in only applies to opt-in feeds.
// Unconstrained generic on purpose: a structural constraint on the Supabase
// builder type triggers TS2589 (excessively deep instantiation).
export function excludeNsfw<Q>(query: Q): Q {
  return (
    query as { neq(column: string, value: unknown): unknown }
  ).neq("is_nsfw", true) as Q
}

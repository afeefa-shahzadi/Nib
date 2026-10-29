"use server"

import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { FLAIR_BY_ID } from "@/lib/flair"

/** Current viewer's IP balance, owned flair ids, and equipped flair. */
export async function getFlairState() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { balance: 0, owned: [] as string[], equipped: null as string | null }

  const [{ data: pts }, { data: profile }] = await Promise.all([
    supabase.from("insight_points").select("points").eq("user_id", user.id),
    supabase.from("profiles").select("flair, flair_owned").eq("id", user.id).maybeSingle(),
  ])
  const balance = (pts ?? []).reduce((s, r) => s + (r.points ?? 0), 0)
  return {
    balance,
    owned: (profile?.flair_owned as string[] | null) ?? [],
    equipped: (profile?.flair as string | null) ?? null,
  }
}

/**
 * Buy (if not owned) and equip a flair. Buying spends IP via a negative
 * insight_points row — the single IP spend path. Owning is permanent, so
 * re-equipping a previously bought flair is free. Pass null to unequip.
 */
export async function setFlair(flairId: string | null) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, reason: "unauthorized" as const }

  if (flairId === null) {
    await supabase.from("profiles").update({ flair: null }).eq("id", user.id)
    return { ok: true as const, equipped: null }
  }

  const flair = FLAIR_BY_ID.get(flairId)
  if (!flair) return { ok: false as const, reason: "unknown_flair" as const }

  const { data: profile } = await supabase
    .from("profiles")
    .select("flair_owned")
    .eq("id", user.id)
    .maybeSingle()
  const owned = (profile?.flair_owned as string[] | null) ?? []

  // Already owned → equip for free.
  if (owned.includes(flairId)) {
    await supabase.from("profiles").update({ flair: flairId }).eq("id", user.id)
    return { ok: true as const, equipped: flairId, spent: 0 }
  }

  // Not owned → one atomic RPC: locks the profile row, checks the IP ledger
  // balance, spends and grants ownership together (balance can't go negative).
  const svc = await createServiceRoleClient()
  const { data: res, error } = await svc.rpc("buy_flair", {
    p_user: user.id,
    p_flair: flairId,
    p_cost: flair.cost,
  })
  if (error) return { ok: false as const, reason: "spend_failed" as const }
  if (res === "insufficient") {
    const { data: pts } = await supabase.from("insight_points").select("points").eq("user_id", user.id)
    const balance = (pts ?? []).reduce((s, r) => s + (r.points ?? 0), 0)
    return { ok: false as const, reason: "insufficient_points" as const, cost: flair.cost, balance }
  }
  return { ok: true as const, equipped: flairId, spent: res === "owned" ? 0 : flair.cost }
}

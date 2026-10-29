/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
// Only client-invokable async actions may live here ("use server" modules
// export server actions exclusively). Pool math + settleReaderPools are in
// lib/reader-pool.ts — the cron route calls settlement there directly.
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"

/**
 * Reader-facing transparency: where did my most recent pool budget go?
 * Returns the latest settled period's per-creator split.
 */
export async function getMyReaderImpact() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    if (!context.userId) return { periodEnd: null, total: 0, splits: [] }

    // Most recent settled period for this reader.
    const { data: latest } = await supabaseAdmin
      .from("reader_pool_distributions")
      .select("period_end")
      .eq("reader_id", context.userId)
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!latest) return { periodEnd: null, total: 0, splits: [] }

    const { data: rows } = await supabaseAdmin
      .from("reader_pool_distributions")
      .select(
        "amount_paise, creator:profiles!reader_pool_distributions_creator_id_fkey(display_name, handle)"
      )
      .eq("reader_id", context.userId)
      .eq("period_end", latest.period_end)
      .order("amount_paise", { ascending: false })

    const splits = ((rows ?? []) as any[]).map((r) => ({
      amountPaise: r.amount_paise as number,
      name: (r.creator?.display_name as string) ?? "Creator",
      handle: (r.creator?.handle as string) ?? null,
    }))
    const total = splits.reduce((s, x) => s + x.amountPaise, 0)
    return { periodEnd: latest.period_end as string, total, splits }
  }
  return await __handler({ context })
}

/**
 * Creator-facing transparency: how much did Reader Pass members send me last
 * settled period, and how many members. The other half of "both wins
 * celebrated" — the creator sees who valued them.
 */
export async function getMyCreatorPoolImpact() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    if (!context.userId) return { periodEnd: null, total: 0, members: 0 }

    const { data: latest } = await supabaseAdmin
      .from("reader_pool_distributions")
      .select("period_end")
      .eq("creator_id", context.userId)
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!latest) return { periodEnd: null, total: 0, members: 0 }

    const { data: rows } = await supabaseAdmin
      .from("reader_pool_distributions")
      .select("amount_paise, reader_id")
      .eq("creator_id", context.userId)
      .eq("period_end", latest.period_end)

    const list = (rows ?? []) as { amount_paise: number; reader_id: string }[]
    const total = list.reduce((s, r) => s + r.amount_paise, 0)
    const members = new Set(list.map((r) => r.reader_id)).size
    return { periodEnd: latest.period_end as string, total, members }
  }
  return await __handler({ context })
}

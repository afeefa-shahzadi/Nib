/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"

export async function getPieceClapStats(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const __handler = async ({ data }: { data: { piece_id: string } }) => {
    const { data: rows } = await supabaseAdmin
      .from("piece_claps")
      .select("count, user_id")
      .eq("piece_id", data.piece_id)
    const total = (rows ?? []).reduce(
      (s: number, r: { count: number | null }) => s + (r.count ?? 0),
      0
    )
    const supporters = (rows ?? []).length
    return { total, supporters }
  }
  return await __handler({ data: args?.data as { piece_id: string } })
}

export async function getMyClaps(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { piece_id: string }
    context: ActionContext
  }) => {
    const { data: row } = await context.supabase
      .from("piece_claps")
      .select("count")
      .eq("piece_id", data.piece_id)
      .eq("user_id", context.userId)
      .maybeSingle()
    return { count: row?.count ?? 0 }
  }
  return await __handler({
    data: args?.data as { piece_id: string },
    context,
  })
}

export async function setMyClaps(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { piece_id: string; count: number }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")
    // Clamp to the 1–50 range the DB enforces. The client sends the total, so a
    // tampered request could otherwise try to write an arbitrary count.
    const count = Math.max(0, Math.min(50, Math.floor(Number(data.count) || 0)))
    if (count === 0) {
      await context.supabase
        .from("piece_claps")
        .delete()
        .eq("piece_id", data.piece_id)
        .eq("user_id", context.userId)
      return { ok: true, count: 0 }
    }
    const { error } = await context.supabase
      .from("piece_claps")
      .upsert(
        { piece_id: data.piece_id, user_id: context.userId, count },
        { onConflict: "piece_id,user_id" }
      )
    if (error) {
      console.error("[claps]", error)
      throw new Error("Couldn't save claps.")
    }
    const { checkClapThreshold } = await import("@/lib/quests.server")
    await checkClapThreshold(context.userId!)
    return { ok: true, count }
  }
  return await __handler({
    data: args?.data as { piece_id: string; count: number },
    context,
  })
}

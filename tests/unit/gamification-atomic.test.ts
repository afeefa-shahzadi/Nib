/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient, type ResolveCtx } from "./fake-supabase"
import { utcDayStart, utcMonthStart } from "@/lib/streak"

let svc: ReturnType<typeof makeFakeClient>
let rpcResult: (fn: string) => any = () => ({ error: null })
const resolve = (c: ResolveCtx): any => {
  if (c.op === "rpc") return rpcResult(c.table)
  if (c.table === "user_reward_claims") return c.op === "insert" ? { error: null } : { data: null }
  if (c.table === "achievements")
    return { data: { id: "a1", stat_key: "daily_login", target_value: 1, reward_xp: 40, reward_credits: 3 } }
  if (c.table === "profiles") return { data: { flair_owned: [] } }
  if (c.table === "insight_points") return { data: [{ points: 500 }] }
  return { data: null }
}
mock.module("@/lib/supabase/server", {
  namedExports: {
    createServiceRoleClient: async () => svc,
    createAdminClient: async () => svc,
    createClient: async () => makeFakeClient(resolve),
  },
})

test("utc day/month starts ignore server timezone", () => {
  const d = new Date("2026-03-31T23:30:00Z")
  assert.equal(utcDayStart(d), "2026-03-31T00:00:00.000Z")
  assert.equal(utcMonthStart(d), "2026-03-01T00:00:00.000Z")
})

test("claimReward awards via atomic RPC, never read-modify-write profiles", async () => {
  svc = makeFakeClient(resolve)
  rpcResult = () => ({ data: [{ old_level: 1, new_level: 2 }], error: null })
  const { claimReward } = await import("@/actions/monetization/quests")
  const r: any = await claimReward("a1", "achievement")
  assert.equal(r.success, true)
  assert.equal(r.new_level, 2)
  const rpc = svc.calls.find((c) => c.op === "rpc") as any
  assert.equal(rpc.table, "claim_award")
  assert.deepEqual(rpc.args, { p_user: "u1", p_xp: 40, p_credits: 3 })
  assert.ok(!svc.calls.some((c) => c.table === "profiles" && c.op === "update"))
})

test("tickQuest awards through one atomic RPC", async () => {
  svc = makeFakeClient(resolve)
  rpcResult = () => ({ data: true, error: null })
  const { tickQuest } = await import("@/lib/quests.server")
  const r = await tickQuest("u1", "read_3")
  assert.deepEqual(r, { already: false, points: 8 })
  assert.ok(!svc.calls.some((c) => c.op === "insert"))
  rpcResult = () => ({ data: false, error: null })
  assert.deepEqual(await tickQuest("u1", "read_3"), { already: true, points: 0 })
})

test("setFlair buys via atomic RPC and maps insufficient", async () => {
  svc = makeFakeClient(resolve)
  rpcResult = () => ({ data: "insufficient", error: null })
  const { setFlair } = await import("@/actions/cosmetics")
  const { FLAIRS } = await import("@/lib/flair")
  const r: any = await setFlair(FLAIRS[0].id)
  assert.equal(r.ok, false)
  assert.equal(r.reason, "insufficient_points")
  assert.ok(!svc.calls.some((c) => c.table === "insight_points" && c.op === "insert"))
  rpcResult = () => ({ data: "ok", error: null })
  const ok: any = await setFlair(FLAIRS[0].id)
  assert.equal(ok.ok, true)
})

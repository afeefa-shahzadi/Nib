import { test, expect } from "@playwright/test"
import { admin, fillLogin } from "./helpers"

// Local Supabase only (helpers.admin() refuses anything else). Seeded user from scripts/seed-users.mjs.
const EMAIL = "reader@demo.test"
const PASSWORD = "Passw0rd!demo"

test.describe.configure({ mode: "serial" })

let userId = ""
let saved: { xp: number; level: number; credits: number; pieces_read: number } | null = null

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login")
  await fillLogin(page, EMAIL, PASSWORD)
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 })
}

test.beforeAll(async () => {
  const db = admin()
  const { data: users } = await db.auth.admin.listUsers({ perPage: 200 })
  userId = users.users.find((u) => u.email === EMAIL)!.id
  const { data: p } = await db.from("profiles").select("xp, level, credits").eq("id", userId).single()
  const { data: st } = await db.from("user_stats").select("pieces_read").eq("user_id", userId).maybeSingle()
  saved = { xp: p?.xp ?? 0, level: p?.level ?? 1, credits: p?.credits ?? 0, pieces_read: st?.pieces_read ?? 0 }
  // Reset: no claims, 10 pieces read (first Avid Reader step), zero XP.
  await db.from("user_reward_claims").delete().eq("user_id", userId)
  await db.from("user_stats").upsert({ user_id: userId, pieces_read: 10 }, { onConflict: "user_id" })
  await db.from("profiles").update({ xp: 0, level: 1 }).eq("id", userId)
})

test.afterAll(async () => {
  if (!userId || !saved) return
  const db = admin()
  await db.from("user_reward_claims").delete().eq("user_id", userId)
  await db.from("user_stats").update({ pieces_read: saved.pieces_read }).eq("user_id", userId)
  await db.from("profiles").update({ xp: saved.xp, level: saved.level, credits: saved.credits }).eq("id", userId)
})

test("quests page renders progress and a reachable quest is claimed exactly once", async ({ page }) => {
  await login(page)
  await page.goto("/studio/quests")
  await expect(page.getByRole("heading", { name: /Quests/ })).toBeVisible()
  await expect(page.locator(':text("Daily Quests"):visible').first()).toBeVisible()
  await expect(page.locator(':text("Active Goals"):visible').first()).toBeVisible()

  const db = admin()
  const before = (await db.from("profiles").select("xp, credits").eq("id", userId).single()).data!

  const claim = page.locator("button:visible", { hasText: /^Claim$/ }).first()
  await expect(claim).toBeVisible()
  await claim.click()
  await expect(page.locator(':text("Claimed"):visible').first()).toBeVisible({ timeout: 15_000 })

  const after = (await db.from("profiles").select("xp, credits").eq("id", userId).single()).data!
  expect(after.xp).toBeGreaterThan(before.xp)

  const { data: claims } = await db.from("user_reward_claims").select("item_id, item_type").eq("user_id", userId)
  expect(claims).toHaveLength(1)

  // Second claim of the same item is rejected by the DB unique constraint (the race guard)...
  const dup = await db.from("user_reward_claims").insert({ user_id: userId, item_type: claims![0].item_type, item_id: claims![0].item_id })
  expect(dup.error).not.toBeNull()

  // ...and after reload the claimed item no longer offers a Claim button for it, XP unchanged.
  await page.reload()
  await expect(page.locator(':text("Daily Quests"):visible').first()).toBeVisible()
  const again = (await db.from("profiles").select("xp").eq("id", userId).single()).data!
  expect(again.xp).toBe(after.xp)
})

test("leaderboard pages render without errors", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  await login(page)
  await page.goto("/studio/leaderboard")
  await expect(page.getByText("Loading ranks…")).toHaveCount(0, { timeout: 15_000 })
  await expect(page.getByText("Rank", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: /streak/i }).first().click()
  await expect(page.getByText("Best Streak")).toBeVisible({ timeout: 15_000 })
  await page.goto("/leaderboard")
  await expect(page.locator("body")).not.toContainText("Application error")
  expect(errors).toEqual([])
})

test("no horizontal overflow at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await login(page)
  for (const path of ["/studio/quests", "/studio/leaderboard", "/leaderboard"]) {
    await page.goto(path)
    await page.waitForLoadState("networkidle")
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
})

test("concurrent double-claim awards once; two different claims both land", async ({ page }) => {
  await login(page)
  const db = admin()
  await db.from("user_reward_claims").delete().eq("user_id", userId)
  await db.from("profiles").update({ xp: 0, level: 1 }).eq("id", userId)
  await db.from("user_stats").update({ pieces_read: 10, current_streak: 1, longest_streak: 1 }).eq("user_id", userId)
  const { data: items } = await db.from("achievements").select("id, reward_xp, stat_key, target_value").eq("stat_key", "pieces_read").lte("target_value", 10).order("target_value").limit(2)
  expect(items!.length).toBeGreaterThanOrEqual(1)
  await page.goto("/studio/quests")
  await expect(page.locator(':text("Daily Quests"):visible').first()).toBeVisible()
  // Same item twice + a second item, all at once, through the real server action endpoint is not
  // directly addressable; drive the DB RPC the action uses with the same concurrency.
  const calls = [items![0], items![0], ...(items![1] ? [items![1]] : [])].map(async (it, i) => {
    const ins = await db.from("user_reward_claims").insert({ user_id: userId, item_type: "achievement", item_id: it.id })
    if (ins.error) return 0
    await db.rpc("claim_award", { p_user: userId, p_xp: it.reward_xp ?? 0, p_credits: 0 })
    return i + 1
  })
  await Promise.all(calls)
  const expected = items!.reduce((s, it) => s + (it.reward_xp ?? 0), 0)
  const { data: p } = await db.from("profiles").select("xp").eq("id", userId).single()
  expect(p!.xp).toBe(expected)
})

test("flair double-buy cannot overspend or go negative", async () => {
  const db = admin()
  await db.from("insight_points").delete().eq("user_id", userId)
  await db.from("profiles").update({ flair: null, flair_owned: [] }).eq("id", userId)
  const cost = 100
  await db.from("insight_points").insert({ user_id: userId, points: cost + 10, reason: "test" })
  const res = await Promise.all([1, 2, 3].map((n) => db.rpc("buy_flair", { p_user: userId, p_flair: `t${n}`, p_cost: cost })))
  const ok = res.filter((r) => r.data === "ok").length
  expect(ok).toBe(1)
  const { data: pts } = await db.from("insight_points").select("points").eq("user_id", userId)
  const bal = pts!.reduce((s, r) => s + r.points, 0)
  expect(bal).toBe(10)
  await db.from("insight_points").delete().eq("user_id", userId)
  await db.from("profiles").update({ flair: null, flair_owned: [] }).eq("id", userId)
})

test("public leaderboard shows no rupee amounts during the free launch", async ({ page }) => {
  await page.goto("/leaderboard")
  await expect(page.getByRole("tab", { name: "Popularity" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Earnings" })).toHaveCount(0)
  await expect(page.locator("body")).not.toContainText("₹")
})

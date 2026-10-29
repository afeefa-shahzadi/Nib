import { test } from "node:test"
import assert from "node:assert/strict"
import { streakStep, isStaleDailyQuest, utcDay, addDays } from "@/lib/streak"

const base = { today: "2026-03-10", current: 5, freezeAvailable: true }

test("first ever tick starts at 1", () => {
  assert.deepEqual(streakStep({ ...base, lastActive: null }), { streak: 1, broke: false, frozen: false, previousStreak: 0 })
})
test("yesterday continues", () => {
  assert.equal(streakStep({ ...base, lastActive: "2026-03-09" }).streak, 6)
})
test("one missed day is forgiven once per month", () => {
  const r = streakStep({ ...base, lastActive: "2026-03-08" })
  assert.equal(r.streak, 6); assert.ok(r.frozen && !r.broke)
})
test("one missed day with freeze spent breaks", () => {
  const r = streakStep({ ...base, lastActive: "2026-03-08", freezeAvailable: false })
  assert.ok(r.broke); assert.equal(r.previousStreak, 5); assert.equal(r.streak, 1)
})
test("a long absence breaks even with a freeze available", () => {
  const r = streakStep({ ...base, lastActive: "2026-01-01" })
  assert.ok(r.broke && !r.frozen); assert.equal(r.previousStreak, 5)
})
test("month/year rollover is calendar-correct", () => {
  assert.equal(addDays("2026-03-01", -1), "2026-02-28")
  assert.equal(streakStep({ ...base, today: "2027-01-01", lastActive: "2026-12-31" }).streak, 6)
})
test("utcDay ignores server timezone", () => {
  assert.equal(utcDay(new Date("2026-03-10T23:30:00Z")), "2026-03-10")
})
test("stale daily quests are rejected, today's and lifetime pass", () => {
  assert.ok(isStaleDailyQuest({ quest_type: "daily", title: "Daily Reader (2026-03-09)" }, "2026-03-10"))
  assert.ok(!isStaleDailyQuest({ quest_type: "daily", title: "Daily Reader (2026-03-10)" }, "2026-03-10"))
  assert.ok(!isStaleDailyQuest({ quest_type: "lifetime", title: "Avid Reader 10" }, "2026-03-10"))
})

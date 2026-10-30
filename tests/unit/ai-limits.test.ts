import { test, afterEach } from "node:test"
import assert from "node:assert/strict"
import {
  aiDailyTokenLimit,
  AI_MAX_OUTPUT_TOKENS,
  AI_MAX_INPUT_CHARS,
} from "@/lib/ai-limits"

// These env vars are read at call time; clear anything a case sets.
afterEach(() => {
  delete process.env.AI_PLATFORM_FUNDED_OFF
  delete process.env.AI_TOKENS_STUDIO
})

test("aiDailyTokenLimit: per-plan defaults", () => {
  assert.equal(aiDailyTokenLimit("free"), 20_000)
  assert.equal(aiDailyTokenLimit("studio"), 250_000)
  assert.equal(aiDailyTokenLimit("org"), 1_000_000)
})

test("aiDailyTokenLimit: unknown / null plan falls back to free", () => {
  assert.equal(aiDailyTokenLimit(undefined), 20_000)
  assert.equal(aiDailyTokenLimit(null), 20_000)
  assert.equal(aiDailyTokenLimit("enterprise-typo"), 20_000)
})

test("aiDailyTokenLimit: env override wins over the default", () => {
  process.env.AI_TOKENS_STUDIO = "30000"
  assert.equal(aiDailyTokenLimit("studio"), 30_000)
})

test("aiDailyTokenLimit: kill switch forces 0 for every plan", () => {
  process.env.AI_PLATFORM_FUNDED_OFF = "1"
  assert.equal(aiDailyTokenLimit("free"), 0)
  assert.equal(aiDailyTokenLimit("studio"), 0)
  assert.equal(aiDailyTokenLimit("org"), 0)
})

test("per-request ceilings are positive and sane", () => {
  assert.ok(AI_MAX_OUTPUT_TOKENS > 0, "output cap set")
  assert.ok(AI_MAX_INPUT_CHARS > 0, "input cap set")
})

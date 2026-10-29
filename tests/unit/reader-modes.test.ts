import { test } from "node:test"
import assert from "node:assert/strict"
import { availableModes } from "../../lib/reader-variants"

const MODES = ["skim", "standard", "expert", "teach", "debate"] as const
const p = (text: string, extra: Record<string, unknown> = {}) => ({ content: { text, ...extra }, mode_visibility: undefined as unknown })

test("no mode data -> standard only", () => {
  const all = { skim: true, standard: true, expert: true, teach: true, debate: true }
  assert.deepEqual(availableModes([{ ...p("a"), mode_visibility: all }, p("b")], MODES), ["standard"])
})

test("a skim-hidden block makes skim available", () => {
  assert.deepEqual(availableModes([p("a"), { ...p("b"), mode_visibility: { skim: false } }], MODES), ["skim", "standard"])
})

test("array-form mode_visibility is honoured", () => {
  assert.deepEqual(availableModes([p("a"), { ...p("b"), mode_visibility: ["standard", "expert", "teach", "debate"] }], MODES), ["skim", "standard"])
})

test("an expert variant makes expert available", () => {
  assert.deepEqual(availableModes([p("a", { aiVariants: { expert: { text: "A, precisely" } } })], MODES), ["standard", "expert"])
})

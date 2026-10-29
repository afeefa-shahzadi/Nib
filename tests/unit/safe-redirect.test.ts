import { test } from "node:test"
import assert from "node:assert/strict"
import { safeRedirect } from "@/lib/safe-redirect"

const ORIGIN = "https://mycelium.app"

test("same-origin paths pass through", () => {
  assert.equal(safeRedirect("/studio/org?invite=abc#x", ORIGIN, "/studio"), "/studio/org?invite=abc#x")
})

test("works without a real origin (SSR) for relative paths", () => {
  assert.equal(safeRedirect("/feed?x=1"), "/feed?x=1")
  assert.equal(safeRedirect("/\\evil.com", undefined, ""), "")
})

test("anything that resolves off-origin falls back", () => {
  for (const raw of ["//evil.com", "/\\evil.com", "/.//evil.com", "/..//evil.com", "/%2e//evil.com", "\\\\evil.com", "https://evil.com/x", "javascript:alert(1)", ""]) {
    assert.equal(safeRedirect(raw, ORIGIN, "/studio"), "/studio", raw)
  }
})

import { test } from "node:test"
import assert from "node:assert/strict"
import { HANDLE_RE, initials } from "@/lib/handle"

test("handles are 3-30 lowercase letters, numbers or _", () => {
  assert.equal(HANDLE_RE.test("qa_reader7"), true)
  assert.equal(HANDLE_RE.test("ab"), false)
  assert.equal(HANDLE_RE.test("Has-Dash"), false)
  assert.equal(HANDLE_RE.test("a".repeat(31)), false)
})

test("initials take first and last word", () => {
  assert.equal(initials("Ada Byron Lovelace"), "AL")
  assert.equal(initials("nib"), "N")
  assert.equal(initials("  "), "?")
})

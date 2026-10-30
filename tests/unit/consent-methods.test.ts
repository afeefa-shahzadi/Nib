import { test } from "node:test"
import assert from "node:assert/strict"
import { parseDigilockerDob, isAdultOn } from "@/lib/consent-methods"

const now = new Date("2026-10-30T12:00:00Z")

test("DigiLocker dates come as DDMMYYYY or ISO", () => {
  assert.equal(parseDigilockerDob("15081985"), "1985-08-15")
  assert.equal(parseDigilockerDob("1985-08-15"), "1985-08-15")
  assert.equal(parseDigilockerDob("15/08/1985"), "1985-08-15")
  assert.equal(parseDigilockerDob("garbage"), null)
  assert.equal(parseDigilockerDob(undefined), null)
})

test("a parent must be 18 or older", () => {
  assert.equal(isAdultOn("2008-10-30", now), true)
  assert.equal(isAdultOn("2008-10-31", now), false)
  assert.equal(isAdultOn(null, now), false)
})

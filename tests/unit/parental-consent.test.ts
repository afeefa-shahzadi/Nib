import { test } from "node:test"
import assert from "node:assert/strict"
import { ageOn, needsParentalConsent } from "@/lib/age"

const now = new Date("2026-10-30T12:00:00Z")

test("age counts whole years, birthday not yet reached this year", () => {
  assert.equal(ageOn("2008-10-31", now), 17)
  assert.equal(ageOn("2008-10-30", now), 18)
  assert.equal(ageOn("not a date", now), null)
})

test("13 to 17 needs a parent; 18 and over doesn't", () => {
  assert.equal(needsParentalConsent("2013-01-01", now), true)
  assert.equal(needsParentalConsent("2008-10-31", now), true)
  assert.equal(needsParentalConsent("2008-10-30", now), false)
  assert.equal(needsParentalConsent("", now), false)
})

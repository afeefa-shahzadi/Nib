import { test } from "node:test"
import assert from "node:assert/strict"
import { validateContact } from "@/lib/contact"

const base = { fullName: "Asha", email: "asha@example.com", intent: "general", details: "Hello" }

test("general question needs no organization", () => {
  assert.equal(validateContact(base), null)
})

test("bug and suggestion need no organization", () => {
  assert.equal(validateContact({ ...base, intent: "bug" }), null)
  assert.equal(validateContact({ ...base, intent: "suggestion" }), null)
})

test("enterprise, education and partnership need an organization", () => {
  for (const intent of ["enterprise", "education", "partnership"]) {
    assert.match(validateContact({ ...base, intent }) ?? "", /organization/i)
    assert.equal(validateContact({ ...base, intent, organizationName: "Acme" }), null)
  }
})

test("rejects missing name, bad email, unknown topic, empty or huge message", () => {
  assert.ok(validateContact({ ...base, fullName: " " }))
  assert.ok(validateContact({ ...base, email: "nope" }))
  assert.ok(validateContact({ ...base, intent: "spam" }))
  assert.ok(validateContact({ ...base, details: "" }))
  assert.ok(validateContact({ ...base, details: "x".repeat(5001) }))
})

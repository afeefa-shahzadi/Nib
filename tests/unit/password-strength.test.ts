import { test } from "node:test"
import assert from "node:assert/strict"
import { passwordStrength } from "@/lib/password-strength"

test("too short is weak and says why", () => {
  assert.deepEqual(passwordStrength("abc"), { level: 0, label: "Too short" })
  assert.equal(passwordStrength("").level, 0)
})

test("long single-class passwords are only fair", () => {
  assert.equal(passwordStrength("abcdefgh").label, "Weak")
  assert.equal(passwordStrength("abcdefghijkl").label, "Fair")
})

test("length plus variety is strong", () => {
  assert.equal(passwordStrength("Tr1cky-passphrase").label, "Strong")
  assert.equal(passwordStrength("Abcdef12").label, "Good")
})

test("common passwords are weak whatever their length", () => {
  assert.equal(passwordStrength("password123").label, "Weak")
})

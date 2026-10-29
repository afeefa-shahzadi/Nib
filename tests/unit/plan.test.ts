import { test, afterEach } from "node:test"
import assert from "node:assert/strict"
import { isLaunchFree, hasStudioAccess, hasOrgAccess } from "@/lib/plan"

const orig = process.env.LAUNCH_FREE
afterEach(() => {
  if (orig === undefined) delete process.env.LAUNCH_FREE
  else process.env.LAUNCH_FREE = orig
})

test("isLaunchFree defaults on", () => {
  delete process.env.LAUNCH_FREE
  assert.equal(isLaunchFree(), true)
})

test('isLaunchFree off only for "0"', () => {
  process.env.LAUNCH_FREE = "0"
  assert.equal(isLaunchFree(), false)
  process.env.LAUNCH_FREE = "false"
  assert.equal(isLaunchFree(), true)
  process.env.LAUNCH_FREE = "1"
  assert.equal(isLaunchFree(), true)
})

test("hasStudioAccess unlocks free under launch", () => {
  process.env.LAUNCH_FREE = "1"
  assert.equal(hasStudioAccess("free"), true)
  process.env.LAUNCH_FREE = "0"
  assert.equal(hasStudioAccess("free"), false)
  assert.equal(hasStudioAccess("studio"), true)
})

test("hasOrgAccess", () => {
  process.env.LAUNCH_FREE = "1"
  assert.equal(hasOrgAccess("studio"), true)
  process.env.LAUNCH_FREE = "0"
  assert.equal(hasOrgAccess("studio"), false)
  assert.equal(hasOrgAccess("org"), true)
})

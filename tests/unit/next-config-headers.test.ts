import { test } from "node:test"
import assert from "node:assert/strict"
import nextConfig from "@/next.config"

test("Permissions-Policy lets our own pages use the microphone (voice dictation)", async () => {
  const rules = await nextConfig.headers!()
  const policy = rules
    .flatMap((r) => r.headers)
    .find((h) => h.key === "Permissions-Policy")!.value
  assert.match(policy, /(^|,\s*)microphone=\(self\)/)
  assert.match(policy, /camera=\(\)/)
  assert.match(policy, /geolocation=\(\)/)
})

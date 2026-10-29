import { test, afterEach } from "node:test"
import assert from "node:assert/strict"
import { encryptSecret, decryptSecret } from "@/lib/crypto"

const env = process.env as Record<string, string | undefined>
const saved = { k: env.BYOK_ENCRYPTION_KEY, n: env.NODE_ENV }
afterEach(() => {
  env.BYOK_ENCRYPTION_KEY = saved.k
  env.NODE_ENV = saved.n
})

test("encryptSecret round-trips with key", () => {
  env.BYOK_ENCRYPTION_KEY = "ab".repeat(32)
  const enc = encryptSecret("sk-x")
  assert.ok(enc.startsWith("enc:v1:"))
  assert.equal(decryptSecret(enc), "sk-x")
})

test("encryptSecret throws in production without key", () => {
  delete env.BYOK_ENCRYPTION_KEY
  env.NODE_ENV = "production"
  assert.throws(() => encryptSecret("sk-x"), /BYOK_ENCRYPTION_KEY is not configured/)
})

test("encryptSecret plaintext fallback in dev", () => {
  delete env.BYOK_ENCRYPTION_KEY
  env.NODE_ENV = "development"
  assert.equal(encryptSecret("sk-x"), "sk-x")
})

test("decryptSecret passes legacy plaintext through", () => {
  delete env.BYOK_ENCRYPTION_KEY
  assert.equal(decryptSecret("sk-legacy"), "sk-legacy")
})

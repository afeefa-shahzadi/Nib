import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

// AES-256-GCM at-rest encryption for user secrets (BYOK API keys).
// Stored format: "enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>".
// The prefix lets decryptSecret transparently pass through legacy plaintext
// rows written before encryption existed.
const PREFIX = "enc:v1:"

function getKey(): Buffer | null {
  const raw = process.env.BYOK_ENCRYPTION_KEY
  if (!raw) return null
  const key = Buffer.from(raw, "hex")
  if (key.length !== 32)
    throw new Error("BYOK_ENCRYPTION_KEY must be 32 bytes hex (64 hex chars)")
  return key
}

export function encryptSecret(plain: string): string {
  const key = getKey()
  // Dev keeps a plaintext fallback; production fails closed.
  if (!key) {
    if (process.env.NODE_ENV === "production")
      throw new Error("BYOK_ENCRYPTION_KEY is not configured")
    return plain
  }
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return (
    PREFIX +
    [iv, tag, ct].map((b) => b.toString("base64")).join(":")
  )
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored // legacy plaintext
  const key = getKey()
  if (!key)
    throw new Error("BYOK_ENCRYPTION_KEY not set but a value is encrypted")
  const [ivB64, tagB64, ctB64] = stored.slice(PREFIX.length).split(":")
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64")
  )
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ])
  return pt.toString("utf8")
}

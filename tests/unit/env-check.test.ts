import { test, afterEach } from "node:test"
import assert from "node:assert/strict"
import { checkEnv } from "@/lib/env-check"
import { getTransporter } from "@/lib/email"

const full = {
  BYOK_ENCRYPTION_KEY: "x",
  SMTP_HOST: "x",
  SMTP_USER: "x",
  SMTP_PASS: "x",
  CRON_SECRET: "x",
  MISTRAL_API_KEY: "x",
  EMAIL_TOKEN_SECRET: "x",
  NEXT_PUBLIC_APP_URL: "x",
  NEXT_PUBLIC_SITE_URL: "x",
  NEXT_PUBLIC_SUPABASE_URL: "x",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "x",
  SUPABASE_SECRET_KEY: "x",
}

test("checkEnv flags missing BYOK and CRON", () => {
  const w = checkEnv({}).join("\n")
  assert.match(w, /BYOK_ENCRYPTION_KEY/)
  assert.match(w, /CRON_SECRET/)
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "NEXT_PUBLIC_SITE_URL"])
    assert.match(w, new RegExp(k))
})

test("checkEnv: full env has no warnings", () => {
  assert.deepEqual(checkEnv(full), [])
})

const env = process.env as Record<string, string | undefined>
const saved = { h: env.SMTP_HOST, n: env.NODE_ENV }
afterEach(() => {
  env.SMTP_HOST = saved.h
  env.NODE_ENV = saved.n
})

test("getTransporter null in production without SMTP_HOST", async () => {
  delete env.SMTP_HOST
  env.NODE_ENV = "production"
  assert.equal(await getTransporter(), null)
})

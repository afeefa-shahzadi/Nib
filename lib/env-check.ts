// Boot-time production env audit. Returns human-readable warning lines.
const REQUIRED: [string, string][] = [
  ["NEXT_PUBLIC_SUPABASE_URL", "the app cannot reach Supabase"],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "the app cannot reach Supabase"],
  ["SUPABASE_SECRET_KEY", "server-side admin operations fail"],
  ["NEXT_PUBLIC_SITE_URL", "subdomain/custom-domain routing breaks"],
  ["BYOK_ENCRYPTION_KEY", "saving user AI keys will fail"],
  ["SMTP_HOST", "no email will be sent"],
  ["SMTP_USER", "SMTP auth may fail"],
  ["SMTP_PASS", "SMTP auth may fail"],
  ["CRON_SECRET", "cron routes return 500"],
  ["MISTRAL_API_KEY", "platform-funded AI is unavailable"],
  ["EMAIL_TOKEN_SECRET", "unsubscribe/confirm links cannot be signed"],
  ["NEXT_PUBLIC_APP_URL", "emails and links point at localhost"],
]

export function checkEnv(env: Record<string, string | undefined> = process.env): string[] {
  const out = REQUIRED.filter(([k]) => !env[k]).map(
    ([k, why]) => `${k} is not set: ${why}`
  )
  if (!env.PISTON_API_URL)
    out.push("PISTON_API_URL is not set (info): code Run buttons are hidden")
  return out
}

/**
 * Quick env + connectivity test.
 * Run: npx tsx tests/verify-env.ts
 */

async function main() {
  const dotenv = await import("fs").then((fs) =>
    fs.readFileSync(".env.local", "utf-8")
  )
  const vars: Record<string, string> = {}
  for (const line of dotenv.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.+)$/)
    if (match) vars[match[1]] = match[2]
  }

  const results: { name: string; status: string; detail?: string }[] = []

  // 1. Supabase
  const sbUrl = vars.NEXT_PUBLIC_SUPABASE_URL
  const sbKey = vars.SUPABASE_SECRET_KEY
  if (!sbUrl || !sbKey) {
    results.push({
      name: "Supabase",
      status: "❌ MISSING",
      detail: `URL=${sbUrl ? "set" : "empty"}, SERVICE_ROLE_KEY=${sbKey ? "set" : "empty"}`,
    })
  } else {
    try {
      const res = await fetch(`${sbUrl}/rest/v1/`, {
        headers: {
          apikey: sbKey,
          Authorization: `Bearer ${sbKey}`,
        },
      })
      results.push({
        name: "Supabase",
        status: res.ok ? "✅ OK" : `⚠️ HTTP ${res.status}`,
        detail: `${res.status} ${res.statusText}`,
      })
    } catch (e) {
      results.push({
        name: "Supabase",
        status: "❌ FAILED",
        detail: (e as Error).message,
      })
    }
  }

  // 2. Mistral
  const mistralKey = vars.MISTRAL_API_KEY
  if (!mistralKey) {
    results.push({
      name: "Mistral AI",
      status: "❌ MISSING",
      detail: "MISTRAL_API_KEY is empty",
    })
  } else {
    try {
      const res = await fetch("https://api.mistral.ai/v1/models", {
        headers: { Authorization: `Bearer ${mistralKey}` },
      })
      const body = await res.json().catch(() => ({}))
      results.push({
        name: "Mistral AI",
        status: res.ok ? "✅ OK" : `⚠️ HTTP ${res.status}`,
        detail: res.ok
          ? `${(body as { data?: unknown[] })?.data?.length ?? "?"} models available`
          : JSON.stringify(body).slice(0, 100),
      })
    } catch (e) {
      results.push({
        name: "Mistral AI",
        status: "❌ FAILED",
        detail: (e as Error).message,
      })
    }
  }

  // 3. Razorpay
  const rzId = vars.RAZORPAY_KEY_ID
  const rzSecret = vars.RAZORPAY_KEY_SECRET
  if (!rzId || !rzSecret) {
    results.push({
      name: "Razorpay",
      status: "❌ MISSING",
      detail: `KEY_ID=${rzId ? "set" : "empty"}, KEY_SECRET=${rzSecret ? "set" : "empty"}`,
    })
  } else {
    try {
      const auth =
        "Basic " + Buffer.from(`${rzId}:${rzSecret}`).toString("base64")
      const res = await fetch("https://api.razorpay.com/v1/payments?count=1", {
        headers: { Authorization: auth },
      })
      results.push({
        name: "Razorpay",
        status: res.ok ? "✅ OK" : `⚠️ HTTP ${res.status}`,
        detail: `${res.status} ${res.statusText}`,
      })
    } catch (e) {
      results.push({
        name: "Razorpay",
        status: "❌ FAILED",
        detail: (e as Error).message,
      })
    }
  }

  // 4. Secrets that fail silently in prod (presence/format only, no API call)
  results.push({
    name: "Razorpay webhook secret",
    status: vars.RAZORPAY_WEBHOOK_SECRET ? "✅ OK" : "❌ MISSING",
    detail: vars.RAZORPAY_WEBHOOK_SECRET
      ? undefined
      : "RAZORPAY_WEBHOOK_SECRET empty — every payment webhook will 500",
  })
  results.push({
    name: "Cron secret",
    status: vars.CRON_SECRET ? "✅ OK" : "❌ MISSING",
    detail: vars.CRON_SECRET
      ? undefined
      : "CRON_SECRET empty — cron routes fail closed (500)",
  })
  const byok = vars.BYOK_ENCRYPTION_KEY
  if (!byok) {
    results.push({
      name: "BYOK encryption key",
      status: "❌ MISSING",
      detail: "BYOK_ENCRYPTION_KEY empty — BYOK secrets stored plaintext",
    })
  } else if (!/^[0-9a-fA-F]{64}$/.test(byok)) {
    results.push({
      name: "BYOK encryption key",
      status: "❌ BAD FORMAT",
      detail: "must be 32 bytes hex (64 chars) — openssl rand -hex 32",
    })
  } else {
    results.push({ name: "BYOK encryption key", status: "✅ OK" })
  }

  // 5. Warn-only (app degrades but does not lose money without these)
  for (const name of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "ALERT_WEBHOOK_URL"]) {
    if (!vars[name]) {
      results.push({
        name,
        status: "⚠️ NOT SET",
        detail:
          name === "ALERT_WEBHOOK_URL"
            ? "money-path alerts will only reach console/Vercel logs"
            : "prod sends no real email without SMTP",
      })
    }
  }

  // Print results
  console.log("\n╔══════════════════════════════════════════╗")
  console.log("║   Nib Environment Verification          ║")
  console.log("╚══════════════════════════════════════════╝\n")
  for (const r of results) {
    console.log(`  ${r.status}  ${r.name}`)
    if (r.detail) console.log(`       ${r.detail}`)
  }
  console.log("")

  const failed = results.filter((r) => r.status.includes("❌"))
  if (failed.length > 0) {
    console.log(
      `⚠️  ${failed.length} service(s) not configured. Fill values in .env.local\n`
    )
    process.exit(1)
  } else {
    console.log("🎉 All services connected!\n")
  }
}

main()

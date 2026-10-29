#!/usr/bin/env node
/**
 * Razorpay money-path e2e smoke test (HUMAN-run, TEST-mode keys only).
 *
 * Exercises the real path once, end to end:
 *   1. Create a real Razorpay TEST-mode order.
 *   2. Seed a matching `purchases` row (status=created) in the test DB.
 *   3. POST a correctly-signed `payment.captured` webhook to the local
 *      /api/webhooks/razorpay endpoint.
 *   4. Assert the DB side-effect: the purchase flipped to `paid` AND an
 *      earnings_ledger row was credited to the author.
 *
 * Creds-guarded: with any required env var unset it prints SKIP and exits 0
 * (same pattern as tests/verify-env.ts). It only READS env the human sets and
 * never hardcodes or prompts for credentials.
 *
 * Run: node scripts/razorpay-e2e-smoke.mjs   (see docs/testing-money-paths.md)
 */
import { createHmac, randomUUID } from "crypto"

const REQUIRED = [
  "RAZORPAY_TEST_KEY_ID",
  "RAZORPAY_TEST_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "APP_BASE_URL", // e.g. http://localhost:3000
  "SUPABASE_TEST_URL",
  "SUPABASE_TEST_SERVICE_KEY",
  "TEST_AUTHOR_ID", // an existing profiles.id in the test DB (the "creator")
]

const env = process.env
const missing = REQUIRED.filter((k) => !env[k])
if (missing.length) {
  console.log(`SKIP: razorpay e2e smoke — missing env: ${missing.join(", ")}`)
  console.log("Set the vars in docs/testing-money-paths.md to run this for real.")
  process.exit(0)
}

const rzAuth =
  "Basic " +
  Buffer.from(`${env.RAZORPAY_TEST_KEY_ID}:${env.RAZORPAY_TEST_KEY_SECRET}`).toString("base64")

function fail(msg, extra) {
  console.error(`FAIL: ${msg}`)
  if (extra !== undefined) console.error(extra)
  process.exit(1)
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const AMOUNT = 15000 // ₹150 in paise

  // 1. Create a real TEST-mode order.
  const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: rzAuth },
    body: JSON.stringify({
      amount: AMOUNT,
      currency: "INR",
      receipt: `e2e_${Date.now()}`,
      notes: { kind: "e2e-smoke" },
    }),
  })
  const order = await orderRes.json()
  if (!orderRes.ok) fail("Razorpay order create failed", order)
  console.log(`  order created: ${order.id}`)

  // 2. Seed the purchase the webhook will settle.
  const paymentId = `pay_e2e_${randomUUID().slice(0, 12)}`
  const { error: insErr } = await db.from("purchases").insert({
    razorpay_order_id: order.id,
    user_id: env.TEST_AUTHOR_ID, // buyer; reuse author for a self-contained run
    author_id: env.TEST_AUTHOR_ID,
    amount_paise: AMOUNT,
    kind: "purchase",
    status: "created",
  })
  if (insErr) fail("seed purchases row failed", insErr)

  const ledgerBefore = await db
    .from("earnings_ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", env.TEST_AUTHOR_ID)

  // 3. POST a correctly-signed payment.captured webhook to the local endpoint.
  const body = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: { id: paymentId, order_id: order.id, status: "captured" },
      },
    },
  })
  const signature = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex")

  const hookRes = await fetch(`${env.APP_BASE_URL}/api/webhooks/razorpay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": signature },
    body,
  })
  const hookText = await hookRes.text()
  if (hookRes.status !== 200) fail(`webhook returned ${hookRes.status}`, hookText)
  console.log(`  webhook accepted: ${hookRes.status} ${hookText}`)

  // 4. Assert the DB side-effect.
  const { data: purchase } = await db
    .from("purchases")
    .select("status, razorpay_payment_id")
    .eq("razorpay_order_id", order.id)
    .maybeSingle()
  if (purchase?.status !== "paid")
    fail(`purchase not settled: status=${purchase?.status}`)
  if (purchase.razorpay_payment_id !== paymentId)
    fail(`payment id not recorded: ${purchase.razorpay_payment_id}`)

  const ledgerAfter = await db
    .from("earnings_ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", env.TEST_AUTHOR_ID)
  if ((ledgerAfter.count ?? 0) <= (ledgerBefore.count ?? 0))
    fail("no earnings_ledger row credited for the author")

  console.log("PASS: order -> signed webhook -> purchase settled + ledger credited")
  process.exit(0)
}

main().catch((e) => fail("uncaught error", e))

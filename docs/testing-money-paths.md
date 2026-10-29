# Testing the Razorpay money path

Two checks guard the payment/webhook/settlement path.

## 1. Webhook signature (creds-free, CI-safe)

Proves the webhook HMAC-SHA256 verification accepts a correctly-signed body and
rejects tampered bodies / wrong signatures, using a known secret — no real keys.

```
npx tsx --test "tests/webhook/**/*.test.ts"
```

## 2. End-to-end smoke (`scripts/razorpay-e2e-smoke.mjs`, human-run)

Creates a real Razorpay **TEST-mode** order, seeds a `purchases` row, POSTs a
signed `payment.captured` webhook to your locally running app, then asserts the
purchase flipped to `paid` and an `earnings_ledger` row was credited.

Skips cleanly (prints `SKIP`, exits 0) if any required env var is unset — so it
never fails CI or leaks the need for live keys.

### Required env

| Var | What |
| --- | --- |
| `RAZORPAY_TEST_KEY_ID` | Razorpay **test-mode** key id (`rzp_test_…`) |
| `RAZORPAY_TEST_KEY_SECRET` | Razorpay test-mode key secret |
| `RAZORPAY_WEBHOOK_SECRET` | The webhook secret the running app uses to verify signatures |
| `APP_BASE_URL` | Where the app is running, e.g. `http://localhost:3000` |
| `SUPABASE_TEST_URL` | Test/staging Supabase project URL |
| `SUPABASE_TEST_SERVICE_KEY` | Service-role key for that test project |
| `TEST_AUTHOR_ID` | An existing `profiles.id` in the test DB (the creator credited) |

Get test keys: Razorpay Dashboard → toggle **Test Mode** → Settings → API Keys →
Generate. Never use live keys here.

### Run

Start the app (`npm run dev`) so `APP_BASE_URL` is reachable, then:

```
node scripts/razorpay-e2e-smoke.mjs
```

### Pass looks like

```
  order created: order_XXXX
  webhook accepted: 200 ok
PASS: order -> signed webhook -> purchase settled + ledger credited
```

Anything else prints `FAIL: <reason>` and exits non-zero.

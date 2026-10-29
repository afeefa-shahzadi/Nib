# Payout automation — go-live checklist

Creator payouts ship **manual by default**: an admin disburses each one out-of-band
and records the result in the admin payout queue. RazorpayX automation
(approve → system disburses → webhook reconciles) turns on only when the four
`RAZORPAYX_*` environment variables are set. Until then nothing below is needed
and the feature costs nothing.

Run this checklist once, when you're ready to automate disbursement.

## 1. Provision RazorpayX

- Create/activate a RazorpayX account and complete its KYC.
- Fund (or set up auto-load for) the RazorpayX virtual account that payouts debit.
- Generate RazorpayX API keys (key id + secret).

## 2. Set environment variables (production)

In the production environment (e.g. Vercel project settings):

- `RAZORPAYX_KEY_ID`
- `RAZORPAYX_KEY_SECRET`
- `RAZORPAYX_ACCOUNT_NUMBER` — the RazorpayX virtual account number payouts debit
- `RAZORPAYX_WEBHOOK_SECRET` — the secret for the payout webhook (step 3)
- `BYOK_ENCRYPTION_KEY` — **must** be set (32-byte hex). Payout methods store the
  PAN and bank account number encrypted (AES-256-GCM) with this key. Without it,
  that PII would be stored in plaintext.

All four `RAZORPAYX_*` must be present together; the admin UI reveals the
**Approve & disburse** button only when `razorpayxConfigured()` is true.

## 3. Register the payout webhook

In the RazorpayX dashboard, add a webhook:

- URL: `https://<your-domain>/api/webhooks/razorpayx`
- Secret: the same value as `RAZORPAYX_WEBHOOK_SECRET`
- Events: `payout.processed`, `payout.failed`, `payout.reversed`

The route verifies the `x-razorpay-signature` HMAC and rejects anything else.

## 4. Smoke test (one real low-value payout)

- As a creator, add a payout method (UPI or bank) with a valid PAN on
  `/studio/earnings`, and request a small payout (≥ ₹400) to a beneficiary you control.
- As an admin on `/admin/payouts`, click **Approve & disburse**. The row moves to
  `processing` (the RazorpayX payout id is stored as its reference).
- Confirm RazorpayX sends the money, then the webhook flips the row to `paid`:
  - a `tds_withholdings` row is recorded (1% TDS, Sec 194-O);
  - the creator receives the "payout is on its way" email with the net amount;
  - the balance reflects the payout.
- Force a failure once (e.g. an invalid beneficiary in RazorpayX test mode) and
  confirm the row goes to `failed`, the reserved funds return to the creator's
  available balance, and the creator gets the "couldn't be processed" email.

## 5. Fallback is always available

If a payout gets stuck or RazorpayX is down, the manual **Mark paid / Mark failed**
controls on `/admin/payouts` still work — they drive the same state machine
(`markPayoutPaid` / `markPayoutFailed`) as the webhook. A `payout.reversed` event
that arrives after a payout is already `paid` cannot auto-reverse (gated
transition); it raises an ops alert for a manual clawback.

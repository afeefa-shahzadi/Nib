const RZX_BASE = "https://api.razorpay.com/v1"

const RZX_VARS = [
  "RAZORPAYX_KEY_ID",
  "RAZORPAYX_KEY_SECRET",
  "RAZORPAYX_ACCOUNT_NUMBER",
  "RAZORPAYX_WEBHOOK_SECRET",
] as const

// Single gate used by the admin action and the admin UI. All four vars present
// ⇒ automation available; otherwise payouts stay manual.
export function razorpayxConfigured(): boolean {
  return RZX_VARS.every((k) => !!process.env[k])
}

function rzxAuth(): string {
  const id = process.env.RAZORPAYX_KEY_ID
  const secret = process.env.RAZORPAYX_KEY_SECRET
  if (!id || !secret) throw new Error("RazorpayX not configured")
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64")
}

export async function rzx(path: string, init: RequestInit = {}) {
  const res = await fetch(`${RZX_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: rzxAuth(),
      ...(init.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      (body as { error?: { description?: string } })?.error?.description ??
      `RazorpayX ${res.status}`
    throw new Error(msg)
  }
  return body
}

export function payoutModeFor(
  methodType: "bank_account" | "vpa"
): "IMPS" | "UPI" {
  return methodType === "vpa" ? "UPI" : "IMPS"
}

export async function createContact(args: {
  name: string
  referenceId: string
}): Promise<{ id: string }> {
  return rzx("/contacts", {
    method: "POST",
    body: JSON.stringify({
      name: args.name,
      type: "customer",
      reference_id: args.referenceId,
    }),
  })
}

export async function createFundAccount(args: {
  contactId: string
  methodType: "bank_account" | "vpa"
  bank?: { name: string; ifsc: string; accountNumber: string }
  vpa?: string
}): Promise<{ id: string }> {
  const payload =
    args.methodType === "vpa"
      ? {
          contact_id: args.contactId,
          account_type: "vpa",
          vpa: { address: args.vpa },
        }
      : {
          contact_id: args.contactId,
          account_type: "bank_account",
          bank_account: {
            name: args.bank!.name,
            ifsc: args.bank!.ifsc,
            account_number: args.bank!.accountNumber,
          },
        }
  return rzx("/fund_accounts", { method: "POST", body: JSON.stringify(payload) })
}

export async function createPayout(args: {
  fundAccountId: string
  amountPaise: number
  idempotencyKey: string
  mode: "IMPS" | "UPI"
  referenceId: string
}): Promise<{ id: string; status: string }> {
  return rzx("/payouts", {
    method: "POST",
    headers: { "X-Payout-Idempotency": args.idempotencyKey },
    body: JSON.stringify({
      account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER,
      fund_account_id: args.fundAccountId,
      amount: args.amountPaise,
      currency: "INR",
      mode: args.mode,
      purpose: "payout",
      reference_id: args.referenceId,
      queue_if_low_balance: true,
    }),
  })
}

export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/
export const VPA_RE = /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/

export type PayoutMethodInput = {
  method_type: "bank_account" | "vpa"
  account_name?: string
  account_number?: string
  ifsc?: string
  vpa?: string
  pan: string
}

// Returns a field->message map; empty = valid. Normalizes IFSC/PAN to upper.
export function validatePayoutMethod(
  input: PayoutMethodInput
): Record<string, string> {
  const e: Record<string, string> = {}
  const pan = (input.pan ?? "").trim().toUpperCase()
  if (!pan) e.pan = "PAN is required for payouts."
  else if (!PAN_RE.test(pan)) e.pan = "Enter a valid PAN (e.g. ABCDE1234F)."

  if (input.method_type === "bank_account") {
    if (!(input.account_name ?? "").trim())
      e.account_name = "Account holder name is required."
    const acct = (input.account_number ?? "").trim()
    if (!/^[0-9]{9,18}$/.test(acct))
      e.account_number = "Enter a valid account number."
    const ifsc = (input.ifsc ?? "").trim().toUpperCase()
    if (!IFSC_RE.test(ifsc)) e.ifsc = "Enter a valid IFSC code."
  } else if (input.method_type === "vpa") {
    if (!VPA_RE.test((input.vpa ?? "").trim()))
      e.vpa = "Enter a valid UPI ID (e.g. name@bank)."
  } else {
    e.method_type = "Choose bank account or UPI."
  }
  return e
}

export function maskAccountNumber(plain: string): string {
  const s = (plain ?? "").trim()
  return s.length <= 4 ? s : "•".repeat(s.length - 4) + s.slice(-4)
}

export function maskPan(plain: string): string {
  const s = (plain ?? "").trim()
  return s.length <= 4 ? s : "•".repeat(s.length - 4) + s.slice(-4)
}

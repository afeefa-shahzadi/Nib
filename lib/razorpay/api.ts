// Server-only Razorpay REST helper (basic auth with the key pair).
const RZ_BASE = "https://api.razorpay.com/v1"

function rzAuthHeader() {
  const id = process.env.RAZORPAY_KEY_ID
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!id || !secret) throw new Error("Razorpay keys not configured")
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64")
}

export async function rzFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${RZ_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: rzAuthHeader(),
      ...(init.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      (body as { error?: { description?: string } })?.error?.description ??
      `Razorpay ${res.status}`
    throw new Error(msg)
  }
  return body
}


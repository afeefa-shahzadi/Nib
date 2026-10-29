import { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { verifyEmailToken } from "@/lib/email-tokens"

// Double opt-in confirmation. A guest subscriber clicks the link from their
// confirm email; we flip author_subscribers.confirmed_at so recipient
// resolution starts including them. Idempotent — re-clicking is harmless.
export const dynamic = "force-dynamic"

function page(bodyHtml: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirm subscription — Nib</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#faf9f7;color:#1a1a1a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}.card{max-width:440px;text-align:center}h1{font-size:22px;margin:0 0 12px}p{color:#555;line-height:1.55;margin:0 0 22px}a{color:#111}</style></head><body><div class="card">${bodyHtml}</div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } }
  )
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const email = p.get("e") ?? ""
  const author = p.get("a") ?? ""
  const token = p.get("t") ?? ""
  if (!email || !author || !verifyEmailToken("confirm", email, author, token)) {
    return page(`<h1>Invalid link</h1><p>This confirmation link is invalid or has expired.</p><p><a href="/">Go to Nib</a></p>`, 400)
  }
  try {
    const svc = await createServiceRoleClient()
    await svc
      .from("author_subscribers")
      .update({ confirmed_at: new Date().toISOString() })
      .eq("author_id", author)
      .eq("subscriber_email", email.toLowerCase())
      .is("confirmed_at", null)
  } catch {
    return page(`<h1>Something went wrong</h1><p>Please try again, or email support.</p>`, 500)
  }
  return page(`<h1>Subscription confirmed</h1><p>You'll now receive new pieces by email. Thanks for subscribing.</p><p><a href="/">Back to Nib</a></p>`)
}

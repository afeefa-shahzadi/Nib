import { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { verifyEmailToken } from "@/lib/email-tokens"

// Unsubscribe landing + one-click endpoint. The emailed link is GET (shows a
// confirm button so an email client prefetching the URL can't silently
// unsubscribe someone); the List-Unsubscribe-Post header points Gmail/Apple at
// the POST, which suppresses immediately (RFC 8058 one-click).
export const dynamic = "force-dynamic"

function page(bodyHtml: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe — Nib</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#faf9f7;color:#1a1a1a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}.card{max-width:440px;text-align:center}h1{font-size:22px;margin:0 0 12px}p{color:#555;line-height:1.55;margin:0 0 22px}button{background:#111;color:#fff;border:0;border-radius:8px;padding:12px 26px;font-size:14px;font-weight:600;cursor:pointer}a{color:#111}</style></head><body><div class="card">${bodyHtml}</div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } }
  )
}

function parse(req: NextRequest) {
  const p = req.nextUrl.searchParams
  return { email: p.get("e") ?? "", author: p.get("a") ?? "", token: p.get("t") ?? "" }
}

async function suppress(email: string, author: string): Promise<void> {
  const svc = await createServiceRoleClient()
  // author "all" → global suppression (author_id NULL), else per-author.
  const author_id = author === "all" ? null : author
  const { error } = await svc
    .from("email_unsubscribes")
    .insert({ email: email.toLowerCase(), author_id })
  // 23505 = already suppressed; that's success, not an error.
  if (error && error.code !== "23505") throw error
}

export async function GET(req: NextRequest) {
  const { email, author, token } = parse(req)
  if (!email || !author || !verifyEmailToken("unsubscribe", email, author, token)) {
    return page(`<h1>Invalid link</h1><p>This unsubscribe link is invalid or has expired.</p><p><a href="/">Go to Nib</a></p>`, 400)
  }
  // POST back to this same URL (query preserved) so the action is an explicit
  // click, not a prefetch GET.
  return page(
    `<h1>Unsubscribe?</h1><p>Stop sending newsletter emails to <strong>${email.replace(/[<>&]/g, "")}</strong>?</p><form method="post"><button type="submit">Unsubscribe</button></form>`
  )
}

export async function POST(req: NextRequest) {
  const { email, author, token } = parse(req)
  if (!email || !author || !verifyEmailToken("unsubscribe", email, author, token)) {
    return page(`<h1>Invalid link</h1><p>This unsubscribe link is invalid or has expired.</p>`, 400)
  }
  try {
    await suppress(email, author)
  } catch {
    return page(`<h1>Something went wrong</h1><p>Please try again, or email support.</p>`, 500)
  }
  return page(`<h1>You're unsubscribed</h1><p><strong>${email.replace(/[<>&]/g, "")}</strong> will no longer receive these newsletter emails.</p><p><a href="/">Back to Nib</a></p>`)
}

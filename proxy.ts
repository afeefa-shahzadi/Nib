/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

// /org pages redirect anonymous users too; doing it here (HTTP 307) instead of
// in the streamed page avoids a client-side swap to /login (CLS 0.31).
const PROTECTED_PREFIXES = ["/studio", "/me", "/notifications", "/org"]
// While a TOTP challenge is pending only the challenge page renders; API
// routes answer 401 instead of a redirect.
const MFA_PAGE = "/login/mfa"
const API_PREFIXES = ["/api", "/auth"]
// Whole segments only: "/api" covers /api and /api/x, not /apiary.
const underPrefix = (path: string, p: string) => path === p || path.startsWith(p + "/")

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // No auth cookie = anonymous: skip the session check entirely. Otherwise
  // getClaims() verifies the JWT locally against the project's cached ES256
  // JWKS (refreshing an expired session first) instead of a getUser() round
  // trip to Supabase Auth on every request. Pages and actions that need a
  // server-verified identity still call getUser() themselves.
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))
  const user = hasSession ? (await supabase.auth.getClaims()).data?.claims ?? null : null

  const pathname = request.nextUrl.pathname
  const isProtected = PROTECTED_PREFIXES.some((p) => underPrefix(pathname, p))

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.search = ""
    // Keep the query: an org invite link is /studio/org?invite=<token>.
    loginUrl.searchParams.set("redirect", pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  // Signed-in readers skip the marketing page.
  if (pathname === "/" && user) {
    const feed = request.nextUrl.clone()
    feed.pathname = "/feed"
    return NextResponse.redirect(feed)
  }

  // A password sign-in only reaches AAL1. Users with a verified TOTP factor
  // must pass the challenge before anything signed-in runs. (Reads the
  // session JWT — no network call.) Requests without a session (webhooks,
  // cron) never get here. RLS backs this up with public.mfa_ok().
  if (user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    const pending = aal?.currentLevel === "aal1" && aal.nextLevel === "aal2"
    // Server actions POST to any page path — /login/mfa included — and a
    // no-JS form POST is an action even without the Next-Action header, so
    // refuse every non-read method everywhere. The challenge page uses only
    // client-side auth calls.
    const isRead = request.method === "GET" || request.method === "HEAD"
    if (pending && (!isRead || request.headers.has("next-action") || API_PREFIXES.some((p) => underPrefix(pathname, p))))
      return NextResponse.json({ error: "Two-factor authentication required" }, { status: 401 })
    if (pending && pathname !== MFA_PAGE) {
      const mfaUrl = request.nextUrl.clone()
      mfaUrl.pathname = "/login/mfa"
      mfaUrl.search = ""
      mfaUrl.searchParams.set("redirect", pathname + request.nextUrl.search)
      const res = NextResponse.redirect(mfaUrl)
      supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c))
      return res
    }
  }

  // --- CUSTOM DOMAIN LOGIC ---
  const hostname = request.headers.get("host") || ""
  const rootDomain = process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host
    : "localhost:3000" 

  // 1. Rewrite for app/studio
  if (
    hostname === `studio.${rootDomain}` ||
    hostname === `studio.localhost:3000` ||
    hostname === `studio.devtunnels.ms`
  ) {
    const rewriteUrl = new URL(
      `/studio${pathname === "/" ? "" : pathname}`,
      request.url
    )
    const rewriteResponse = NextResponse.rewrite(rewriteUrl)
    supabaseResponse.cookies.getAll().forEach((c) => {
      rewriteResponse.cookies.set(
        c.name,
        c.value,
        c as any as NonNullable<
          Parameters<typeof rewriteResponse.cookies.set>[2]
        >
      )
    })
    return rewriteResponse
  }

  // Custom domains (org/profile hosts) used to be resolved here, but neither
  // organizations nor profiles has a custom_domain column in prod, so those two
  // lookups failed on every request to a non-root host. Re-add with the column.

  // --- END CUSTOM DOMAIN LOGIC ---

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

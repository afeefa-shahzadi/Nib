/**
 * Post-sign-in redirect target, limited to this origin. A prefix check like
 * `startsWith("/") && !startsWith("//")` lets `/\evil.com` through — browsers
 * read the backslash as a slash. Resolve it and compare origins instead.
 */
// `origin` defaults to a placeholder so it also works during SSR: a relative
// same-site path resolves onto whatever base it is given.
export function safeRedirect(
  raw: string,
  origin = "http://same-origin.invalid",
  fallback = "/"
): string {
  if (!raw) return fallback
  try {
    const u = new URL(raw, origin)
    const out = u.pathname + u.search + u.hash
    // Dot-segments normalize `/.//evil.com` to the pathname `//evil.com`,
    // which the browser then reads as protocol-relative.
    return u.origin === origin && !out.startsWith("//") ? out : fallback
  } catch {
    return fallback
  }
}

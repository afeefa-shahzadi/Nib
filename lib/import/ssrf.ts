// Block server-side fetches to internal/loopback/link-local hosts (SSRF). A
// hostname check won't stop DNS rebinding, but it's the pragmatic bar for a
// user-initiated fetch of a public article / its images. Shared by the import
// route (URL fetch) and image rehosting.
export function isPrivateHost(h: string): boolean {
  const host = h.toLowerCase().replace(/^\[|\]$/g, "")
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true
  if (host === "::1" || host.startsWith("fe80") || host.startsWith("fc") || host.startsWith("fd")) return true
  // A bare integer or hex host (e.g. 2130706433 or 0x7f000001 = 127.0.0.1) is an
  // alternate IP encoding that the dotted-quad regex below misses. No real domain
  // is all-numeric, so block it outright.
  if (/^(0x[0-9a-f]+|\d+)$/i.test(host)) return true
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (m) {
    const a = Number(m[1]), b = Number(m[2])
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
  }
  return false
}

// Fetch a user-supplied URL with SSRF protection on every hop. `redirect: "follow"`
// would let a public URL 3xx-redirect to an internal host (169.254.169.254, etc.),
// so follow redirects manually and re-validate each Location before fetching it.
// ponytail: hostname check only — won't stop DNS rebinding; pragmatic bar for a
// user-initiated fetch of a public article.
export async function safeFetch(
  url: string,
  init?: RequestInit,
  maxHops = 5
): Promise<Response> {
  let current = url
  for (let hop = 0; hop <= maxHops; hop++) {
    const u = new URL(current)
    if (!/^https?:$/.test(u.protocol) || isPrivateHost(u.hostname))
      throw new Error("blocked host")
    const res = await fetch(current, { ...init, redirect: "manual" })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location")
      if (!loc) return res
      current = new URL(loc, current).toString()
      continue
    }
    return res
  }
  throw new Error("too many redirects")
}

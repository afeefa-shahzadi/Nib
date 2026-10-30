// Website and social links on a profile: https only, at most 5, labelled for display.
export const MAX_LINKS = 5
const NAMES: Record<string, string> = {
  "x.com": "X",
  "twitter.com": "X",
  "linkedin.com": "LinkedIn",
  "github.com": "GitHub",
  "instagram.com": "Instagram",
  "youtube.com": "YouTube",
  "substack.com": "Substack",
  "medium.com": "Medium",
  "bsky.app": "Bluesky",
  "mastodon.social": "Mastodon",
  "threads.net": "Threads",
}

export function normalizeLink(v: unknown): string | null {
  const raw = typeof v === "string" ? v.trim() : ""
  if (!raw) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    throw new Error(`“${raw}” isn't a web address.`)
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`“${raw}” isn't a web address.`)
  if (!url.hostname.includes(".")) throw new Error(`“${raw}” isn't a web address.`)
  url.protocol = "https:"
  const out = url.toString()
  if (out.length > 300) throw new Error("That link is too long.")
  return out
}

export function normalizeLinks(list: unknown): string[] {
  const out: string[] = []
  for (const v of Array.isArray(list) ? list : []) {
    const l = normalizeLink(v)
    if (l && !out.includes(l)) out.push(l)
    if (out.length === MAX_LINKS) break
  }
  return out
}

export function linkLabel(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, "")
  return NAMES[host] ?? host
}

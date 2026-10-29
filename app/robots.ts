import type { MetadataRoute } from "next"

// Q1 crawler policy (see the strategy discussion). robots.txt is advisory — the
// real wall on private routes is auth + rate limiting. This encodes intent:
//   * answer/search engines (Googlebot, Bingbot, OAI-SearchBot, PerplexityBot,
//     ChatGPT-User, Claude-User…) follow the `*` rules and may read public pieces.
//   * pure training crawlers are disallowed by default — creators own their
//     content (Terms §3). ponytail: a per-piece/per-account opt-IN can relax this
//     later via an X-Robots-Tag header on the piece route; not built yet.
const TRAINING_CRAWLERS = [
  "GPTBot",
  "CCBot",
  "Google-Extended",
  "anthropic-ai",
  "ClaudeBot",
  "Applebot-Extended",
  "Bytespider",
  "Meta-ExternalAgent",
]

// Non-public surfaces: auth-walled, expensive, or not content. Kept out of all
// crawl budgets regardless of user agent.
const PRIVATE_PATHS = ["/studio", "/admin", "/api/", "/me/", "/search"]

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      ...TRAINING_CRAWLERS.map((userAgent) => ({ userAgent, disallow: "/" })),
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}

// llms.txt — a machine-readable orientation for answer engines / agents (GEO/AEO).
// Spec: https://llmstxt.org. Served at /llms.txt.
export function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const body = `# Nib

> Nib is a publishing platform for adaptive, mode-switching pieces — one work a reader can consume as a skim, a standard read, an expert deep-dive, a teaching scaffold, or a debate. Writers publish; readers tip, subscribe, and follow.

## Public content
- [Sitemap](${base}/sitemap.xml): every public, published piece
- [Feed](${base}/feed.xml): latest published pieces

## For crawlers and agents
- Public published pieces are available for answer-engine indexing and citation.
- Do not crawl /studio, /admin, /api, /me, or /search — these are private or non-content.
- Training crawlers are disallowed by default; see ${base}/robots.txt.
- NSFW-flagged pieces are excluded from indexing and feeds.
`
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  })
}

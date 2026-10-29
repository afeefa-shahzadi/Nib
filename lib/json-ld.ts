// Serialize an object for a <script type="application/ld+json"> body.
// JSON.stringify does NOT escape "<", so a user-controlled field containing
// "</script>" would close the script tag early and inject markup (stored XSS).
// Escaping "<" to its < form is inert inside JSON and blocks the breakout.
export function jsonLdHtml(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c")
}

// Wraps every occurrence of a reader's selected text inside an HTML string.
// The selection is plain text, but the HTML may split it with tags (<strong>),
// entities (&#39;) or different whitespace, so the match tolerates all three
// and only the text runs between tags get wrapped, keeping the HTML valid.
const QUOTE = "(?:'|&#39;|&#x27;|&apos;|’)"
const CHAR: Record<string, string> = {
  "'": QUOTE,
  "’": QUOTE,
  '"': '(?:"|&quot;|&#34;|“|”)',
  "&": "(?:&|&amp;)",
  "<": "&lt;",
  ">": "&gt;",
}
const escapeRx = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const TAG = "(?:<[^>]+>)*"
const SPACE = "(?:\\s|&nbsp;|<[^>]+>)+"

export function markText(html: string, needle: string, wrap: (text: string) => string): string {
  const words = needle.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return html
  const word = (w: string) => [...w].map((c) => CHAR[c] ?? escapeRx(c)).join(TAG)
  const rx = new RegExp(words.map(word).join(SPACE), "gi")
  return html.replace(rx, (m) => m.replace(/[^<>]+(?=<|$)/g, (run) => wrap(run)))
}

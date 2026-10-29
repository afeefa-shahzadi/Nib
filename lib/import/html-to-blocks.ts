import * as cheerio from "cheerio"

// Convert an article's HTML (a Medium/Substack export file, or a fetched page's
// main content) into Nib block rows. Output shape matches what the blocks
// table / reader expect: { type, content:{ text, html?, lang?, url?, ... } }.
// Reader sanitizes block HTML on render (DOMPurify), so this keeps the inline
// markup and relies on that as the safety net; we only strip scripts/styles.

export type ImportedBlock = { type: string; content: Record<string, unknown> }

// cheerio bundles domhandler but doesn't re-export its node types in a way TS
// can resolve at this import site, so describe the two fields we read. `El` is
// what cheerio's own accepted-element param resolves to (names AnyNode for us).
type DomNode = { type: string; tagName?: string }
type El = Parameters<cheerio.CheerioAPI>[0]

const CONTAINER_TAGS = new Set([
  "div", "section", "main", "article", "header", "footer", "body", "html", "picture",
])

// Platform embeds that live as a blockquote + link (we convert to an embed block).
const EMBED_BLOCKQUOTE = /twitter-tweet|instagram-media|tiktok-embed|mastodon/i

// Best image URL: eager src, then common lazy-load attrs, then the largest
// candidate in srcset. Medium/Substack lazy-load, so data-src/srcset matter.
function imgSrc($: cheerio.CheerioAPI, el: DomNode): string | undefined {
  const n = $(el as unknown as El)
  const direct = n.attr("src") || n.attr("data-src") || n.attr("data-original")
  if (direct && !/^data:/i.test(direct)) return absUrl(direct)
  const srcset = n.attr("srcset") || n.attr("data-srcset")
  if (srcset) {
    const last = srcset.split(",").pop()?.trim().split(/\s+/)[0]
    if (last) return absUrl(last)
  }
  return direct && !/^data:/i.test(direct) ? absUrl(direct) : undefined
}

// Normalize a protocol-relative URL (//cdn/..., common on Wikipedia and many
// CDNs) to https so it fetches + rehosts. Base-relative paths (/img/x.jpg) are
// left as-is — ponytail: thread a base URL through if a source needs it.
function absUrl(u: string): string {
  return u.startsWith("//") ? `https:${u}` : u
}

// The post body on a live page/export, most-specific first: Substack's
// .available-content, Medium export's .e-content, then generic article/main.
// Scoping here keeps page chrome (comments, "Ready for more?" subscribe CTA,
// recirculation) out of the import — those sit outside the content container.
const CONTENT_ROOTS = [".available-content", ".e-content", "[data-field='body']", "article", "main"]

function pickRoot($: cheerio.CheerioAPI): El {
  for (const sel of CONTENT_ROOTS) {
    const el = $(sel).first()
    if (el.length && el.text().replace(/\s+/g, " ").trim().length > 200)
      return el as unknown as El
  }
  return $.root() as unknown as El
}

export function htmlToBlocks(html: string): ImportedBlock[] {
  const $ = cheerio.load(html)
  $("script, style, noscript, nav, aside, footer").remove()

  // Walk the post body, not the whole document — the walker recurses through
  // its container children. Chrome outside the content root never enters.
  const rows: ImportedBlock[] = []
  $(pickRoot($))
    .contents()
    .each((_, el) => walk($, el as unknown as DomNode, rows))

  if (rows.length === 0) {
    const t = $("body").text().replace(/\s+/g, " ").trim()
    if (t) rows.push({ type: "paragraph", content: { text: t, html: "" } })
  }
  return rows
}

function walk($: cheerio.CheerioAPI, el: DomNode, rows: ImportedBlock[]) {
  if (el.type !== "tag") return
  const tag = el.tagName?.toLowerCase()
  if (!tag) return
  const node = $(el as unknown as El)

  const pushRich = (type: string, outer = false) => {
    const text = node.text().replace(/ /g, " ").trim()
    const inner = outer ? $.html(node) : node.html() ?? ""
    const htmlStr = inner.trim()
    if (!text && !htmlStr) return
    rows.push({ type, content: { text, html: htmlStr } })
  }

  switch (tag) {
    case "h1":
    case "h2":
      rows.push({ type: "heading", content: { text: node.text().trim(), level: 2 } })
      return
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      rows.push({ type: "heading", content: { text: node.text().trim(), level: 3 } })
      return
    case "blockquote": {
      // A tweet/IG/TikTok embed is a blockquote wrapping the post link.
      if (EMBED_BLOCKQUOTE.test(node.attr("class") || "")) {
        const href = node.find("a[href]").last().attr("href")
        if (href && /^https?:/i.test(href)) {
          rows.push({ type: "embed", content: { embedUrl: href.split("?")[0], embedTitle: "" } })
          return
        }
      }
      pushRich("quote")
      return
    }
    case "pre": {
      const code = node.find("code").first()
      const text = (code.length ? code.text() : node.text()).replace(/\n$/, "")
      const cls = code.attr("class") || node.attr("class") || ""
      const m = /language-([\w+#.-]+)/.exec(cls)
      if (text.trim())
        rows.push({ type: "code", content: { text, lang: m ? m[1].toLowerCase() : "text" } })
      return
    }
    case "ul":
    case "ol":
      // No list block type — keep the list markup as rich paragraph HTML so the
      // reader's prose renderer shows it as a list.
      pushRich("paragraph", true)
      return
    case "p":
      pushRich("paragraph")
      return
    case "figure": {
      const imgEl = node.find("img").first().get(0) as unknown as DomNode | undefined
      const src = imgEl ? imgSrc($, imgEl) : undefined
      const caption = node.find("figcaption").first().text().trim()
      if (src) {
        rows.push({
          type: "image",
          content: { imageUrl: src, alt: node.find("img").first().attr("alt") || caption || "", caption: caption || undefined },
        })
        return
      }
      // A figure can instead wrap an embed (YouTube/Vimeo iframe).
      const iframe = node.find("iframe").first()
      const isrc = iframe.attr("src") || iframe.attr("data-src")
      if (isrc && /^https?:/i.test(isrc)) {
        rows.push({ type: "embed", content: { embedUrl: isrc, embedTitle: caption || "" } })
      }
      return
    }
    case "img": {
      const src = imgSrc($, el)
      if (src) rows.push({ type: "image", content: { imageUrl: src, alt: node.attr("alt") || "" } })
      return
    }
    case "iframe": {
      const src = node.attr("src") || node.attr("data-src")
      if (src && /^https?:/i.test(src))
        rows.push({ type: "embed", content: { embedUrl: src, embedTitle: node.attr("title") || "" } })
      return
    }
    case "hr":
      return
    default:
      if (CONTAINER_TAGS.has(tag)) {
        node.contents().each((_, c) => walk($, c as unknown as DomNode, rows))
      }
      // inline/unknown leaf tags are ignored (their text surfaces via a parent
      // block or a container recursion)
      return
  }
}

// Best-effort source URL: Medium export's microformat canonical link, else a
// standard canonical/og:url. Used as provenance + the rel=canonical target so
// the original keeps its search credit. Returns an absolute http(s) URL or null.
export function extractCanonical(html: string): string | null {
  const $ = cheerio.load(html)
  const candidates = [
    $("a.p-canonical").attr("href"),
    $('link[rel="canonical"]').attr("href"),
    $('meta[property="og:url"]').attr("content"),
  ]
  for (const c of candidates) {
    const u = c?.trim()
    if (u && /^https?:\/\//i.test(u)) return u
  }
  return null
}

// Best-effort title: an explicit microformat/OG title, else the first heading.
export function extractTitle(html: string): string | null {
  const $ = cheerio.load(html)
  const candidates = [
    $("h1.p-name").first().text(),
    $('meta[property="og:title"]').attr("content") || "",
    $("title").first().text(),
    $("h1").first().text(),
    $("h2").first().text(),
  ]
  for (const c of candidates) {
    const t = c?.replace(/\s+/g, " ").trim()
    if (t) return t
  }
  return null
}

import { BRAND_NAME, BRAND_TAGLINE, SITE_URL } from "@/lib/brand"

// Light-theme Nib palette (app/globals.css :root + ink accent) as hex: email clients don't do oklch.
export const NIB_EMAIL = {
  bg: "#f7f4ee",
  card: "#fdfcf9",
  ink: "#2b2724",
  muted: "#6f6a64",
  border: "#e5dfd5",
  primary: "#2f5196",
  success: "#1f7a7a",
  warning: "#9a3b33",
  onPrimary: "#faf8f5",
  serif: `'Source Serif 4', Georgia, 'Times New Roman', serif`,
  sans: `Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif`,
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const C = NIB_EMAIL

export type EmailTone = "info" | "success" | "warning"
const toneColor = (t: EmailTone = "info") => (t === "success" ? C.success : t === "warning" ? C.warning : C.primary)

export type NibLayoutOptions = {
  preview?: string
  /** Small uppercase label above the content, e.g. "Payout" or "Copyright notice". */
  eyebrow?: string
  /** Accent for the card's top rule and eyebrow: info (ink), success (teal), warning (oxblood). */
  tone?: EmailTone
  footer?: string
  unsubscribeUrl?: string
}

/** Call-to-action button; full width on phones. */
export function nibButton(label: string, url: string, tone: EmailTone = "info") {
  return `<p style="margin:28px 0 8px"><a class="nib-btn" href="${escapeHtml(url)}" style="display:inline-block;background:${toneColor(tone)};color:${C.onPrimary};padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;font-family:${C.sans}">${escapeHtml(label)}</a></p>`
}

/**
 * Wraps body HTML in the Nib frame: mark + wordmark, paper card, quiet footer.
 * Body paragraphs inherit ink/sans; <h1> inside the body gets the display serif.
 */
export function nibLayout(body: string, opts: NibLayoutOptions = {}) {
  const accent = toneColor(opts.tone)
  const eyebrow = opts.eyebrow
    ? `<p style="margin:0 0 10px;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:${accent}">${escapeHtml(opts.eyebrow)}</p>`
    : ""
  const preview = opts.preview
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(opts.preview)}</div>`
    : ""
  const footer =
    (opts.footer ? `${escapeHtml(opts.footer)}<br>` : "") +
    (opts.unsubscribeUrl ? `<a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:${C.muted}">Unsubscribe</a><br>` : "")
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${BRAND_NAME}</title>
<style>.nib-body h1{font-family:${C.serif};font-weight:400;font-size:26px;line-height:1.25;color:${C.ink};margin:0 0 16px}.nib-body p{margin:0 0 14px}.nib-body a{color:${C.primary}}.nib-body .nib-btn{color:${C.onPrimary}}.nib-muted{font-size:13px;color:${C.muted}}.nib-label{margin:20px 0 6px!important;font-size:13px;font-weight:600;color:${C.muted}}.nib-note{background:${C.bg};border-left:3px solid ${C.border};padding:12px 16px;border-radius:6px;font-size:15px}
@media (max-width:480px){.nib-outer{padding:20px 10px!important}.nib-card{padding:24px 20px!important}.nib-body h1{font-size:22px!important}.nib-btn{display:block!important;text-align:center!important}}</style></head>
<body style="margin:0;padding:0;background:${C.bg}">${preview}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td class="nib-outer" align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 20px"><a href="${escapeHtml(SITE_URL)}" style="text-decoration:none;color:${C.ink}"><img src="${escapeHtml(SITE_URL)}/apple-icon.png" width="28" height="28" alt="" style="vertical-align:middle;border:0;border-radius:6px"> <span style="vertical-align:middle;font-family:${C.serif};font-size:24px;letter-spacing:-0.02em;color:${C.ink}">nib</span></a></td></tr>
<tr><td class="nib-body nib-card" style="background:${C.card};border:1px solid ${C.border};border-top:4px solid ${accent};border-radius:12px;padding:32px;font-family:${C.sans};font-size:16px;line-height:1.6;color:${C.ink}">${eyebrow}${body}</td></tr>
<tr><td style="padding:20px 4px 0;font-family:${C.sans};font-size:12px;line-height:1.6;color:${C.muted}">${footer}${escapeHtml(BRAND_NAME)} · ${escapeHtml(BRAND_TAGLINE)}</td></tr>
</table></td></tr></table></body></html>`
}

/** Display name safe inside a quoted From header: drops quotes, backslashes and line breaks. */
export const fromName = (name: string) => name.replace(/["\\\r\n]/g, "")

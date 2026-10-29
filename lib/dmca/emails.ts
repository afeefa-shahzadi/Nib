// Plain transactional HTML for the two DMCA notifications. [human-legal-verify]
// the wording before launch. Kept as pure builders so the actions stay testable.
// [human-legal-verify] the wording in the HTML below; markers stay in code, never in the sent mail.
import { escapeHtml as esc, nibButton, type NibLayoutOptions } from "@/lib/email-layout"

export function authorDisabledEmail(opts: { pieceTitle: string; counterUrl: string }) {
  return {
    subject: "Your piece was disabled following a copyright claim",
    layout: { eyebrow: "Copyright notice", tone: "warning" } satisfies NibLayoutOptions,
    html: `<h1>Your piece has been disabled</h1>
<p>We received a copyright notice about <strong>${esc(opts.pieceTitle)}</strong>. While we review it, the piece is hidden from readers.</p>
<p>If you believe this is a mistake or a misidentification, you can file a counter-notice. We'll forward it to the claimant, and the piece may be restored after the waiting period.</p>
${nibButton("File a counter-notice", opts.counterUrl, "warning")}
<p class="nib-muted">This email is not legal advice.</p>`,
  }
}

export function complainantCounterEmail(opts: {
  pieceTitle: string
  statement: string
  contact: string
}) {
  return {
    subject: "A counter-notice was filed for your copyright claim",
    layout: { eyebrow: "Copyright notice" } satisfies NibLayoutOptions,
    html: `<h1>A counter-notice was filed</h1>
<p>The author of <strong>${esc(opts.pieceTitle)}</strong> has responded to your copyright claim.</p>
<p class="nib-label">Their statement</p>
<div class="nib-note">${esc(opts.statement)}</div>
<p class="nib-label">Their contact details</p>
<div class="nib-note">${esc(opts.contact)}</div>
<p style="margin-top:20px">Unless we're told that you've filed an action seeking a court order, the content may be restored after the statutory waiting period.</p>`,
  }
}

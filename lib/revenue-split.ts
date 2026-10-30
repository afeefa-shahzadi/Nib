// Who gets what from one paid sale, in paise. Pure, so settlement and tests share it.
//   Processing: the gateway fee (2% + 18% GST) comes off the top at cost, so
//               Nib's percentage is margin and no sale can cost Nib money.
//   Free plan:  author 95% of tips, 93% of sales, 85% of sponsorships (of the net).
//   Studio:     100% of the net until the month's sales pass ₹50,000, then 95%.
//   Curated:    the curator takes 15% of the net. On Free the author gets 78%
//               (Nib keeps 7%); on Studio it comes out of the author's share.
import { GST_RATE } from "@/lib/tax"

export const STUDIO_CAP_PAISE = 5_000_000
export const CURATOR_SHARE = 0.15
export const GATEWAY_RATE = 0.02
export const AUTHOR_SHARE_FREE_TIP = 0.95
export const AUTHOR_SHARE_FREE = 0.93
export const AUTHOR_SHARE_SPONSORSHIP = 0.85
export const AUTHOR_SHARE_CURATED = 0.78
export const STUDIO_OVER_CAP_SHARE = 0.95

export type SaleKind = "tip" | "sponsorship" | "purchase"

export function processingFeePaise(grossPaise: number): number {
  return Math.min(grossPaise, Math.ceil(grossPaise * GATEWAY_RATE * (1 + GST_RATE)))
}

export function splitSale(args: {
  grossPaise: number
  kind: SaleKind
  isStudio: boolean
  /** Studio author's gross sales so far this month, before this sale. */
  studioMonthGmvPaise: number
  curated: boolean
  /** Razorpay's actual fee+tax for this payment, when known; else estimated. */
  processingPaise?: number | null
}): { processing: number; author: number; curator: number; platform: number } {
  const { grossPaise: gross, kind, isStudio, studioMonthGmvPaise, curated } = args
  const processing =
    args.processingPaise != null
      ? Math.min(gross, Math.max(0, Math.round(args.processingPaise)))
      : processingFeePaise(gross)
  const net = gross - processing
  const curator = curated ? Math.floor(net * CURATOR_SHARE) : 0
  let author: number
  if (isStudio) {
    const base = studioMonthGmvPaise + gross > STUDIO_CAP_PAISE ? Math.floor(net * STUDIO_OVER_CAP_SHARE) : net
    author = base - curator
  } else if (curated) {
    author = Math.floor(net * AUTHOR_SHARE_CURATED)
  } else {
    const share = kind === "tip" ? AUTHOR_SHARE_FREE_TIP : kind === "sponsorship" ? AUTHOR_SHARE_SPONSORSHIP : AUTHOR_SHARE_FREE
    author = Math.floor(net * share)
  }
  return { processing, author, curator, platform: net - author - curator }
}

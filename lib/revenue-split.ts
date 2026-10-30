// Who gets what from one paid sale, in paise. Pure, so settlement and tests share it.
//   Free plan:  tips/purchases 90% author, sponsorships 80%.
//   Studio:     100% author until the month's sales pass ₹50,000, then 95%.
//   Curated:    a curator referral takes 15% of the gross. On Free the author gets
//               70% (platform keeps 15%); on Studio it comes out of the author's share.
export const STUDIO_CAP_PAISE = 5_000_000
export const CURATOR_SHARE = 0.15

export type SaleKind = "tip" | "sponsorship" | "purchase"

export function splitSale(args: {
  grossPaise: number
  kind: SaleKind
  isStudio: boolean
  /** Studio author's gross sales so far this month, before this sale. */
  studioMonthGmvPaise: number
  curated: boolean
}): { author: number; curator: number; platform: number } {
  const { grossPaise: gross, kind, isStudio, studioMonthGmvPaise, curated } = args
  const curator = curated ? Math.floor(gross * CURATOR_SHARE) : 0
  let author: number
  if (isStudio) {
    const base = studioMonthGmvPaise + gross > STUDIO_CAP_PAISE ? Math.floor(gross * 0.95) : gross
    author = base - curator
  } else if (curated) {
    author = Math.floor(gross * 0.7)
  } else {
    author = Math.floor(gross * (kind === "sponsorship" ? 0.8 : 0.9))
  }
  return { author, curator, platform: gross - author - curator }
}

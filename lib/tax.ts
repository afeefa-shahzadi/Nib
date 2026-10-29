// India tax math for the payout + fee rails. Pure and framework-free so it runs
// on server, client, and in tests. ONE place for the rates.
//
// ⚠️ These rates and their applicability are entity-specific and NOT legal
// advice. 194-O TDS has a small-seller threshold (₹5L/yr) and a PAN-missing
// higher rate; GST registration/rate depends on turnover and place of supply.
// A CA MUST confirm before these numbers are treated as filed truth. We default
// to withholding/recording on everyone: over-withholding is refundable to the
// creator and legally safe, under-withholding is the platform's penalty.

export const TDS_RATE = 0.01 // Sec 194-O, e-commerce operator, resident seller
export const GST_RATE = 0.18 // platform fee = taxable service

// TDS withheld from a creator payout. Deducted from the gross the creator asked
// to withdraw; the creator claims it as a TDS credit in their ITR.
export function tdsOnPayoutPaise(grossPaise: number): number {
  return Math.round(grossPaise * TDS_RATE)
}

// GST contained in a platform fee, treating the fee as GST-INCLUSIVE (the fee
// we already take contains the tax, we don't bill extra on top). fee=118 -> 18.
export function gstFromInclusiveFeePaise(feePaise: number): number {
  return Math.round((feePaise * GST_RATE) / (1 + GST_RATE))
}

// Indian financial year (Apr–Mar) quarter label, e.g. 2026-07 -> "FY2026-27-Q2".
export function indianFyQuarter(d: Date): string {
  const m = d.getUTCMonth() // 0=Jan
  const y = d.getUTCFullYear()
  const fyStart = m >= 3 ? y : y - 1 // FY starts in April
  const q = Math.floor(((m + 9) % 12) / 3) + 1 // Apr->Q1 … Jan-Mar->Q4
  const nn = String((fyStart + 1) % 100).padStart(2, "0")
  return `FY${fyStart}-${nn}-Q${q}`
}

// [start, end) UTC bounds of the FY quarter containing `d`. For the tax report.
export function fyQuarterBounds(d: Date): { startISO: string; endISO: string } {
  const m = d.getUTCMonth()
  const y = d.getUTCFullYear()
  // First month of this FY quarter: Apr/Jul/Oct/Jan.
  const qFirstMonth = Math.floor(m / 3) * 3 // calendar-quarter first month
  // Map calendar quarter to FY quarter start month (Jan-Mar belongs to prev year's Q4).
  const start = new Date(Date.UTC(y, qFirstMonth, 1))
  const end = new Date(Date.UTC(y, qFirstMonth + 3, 1))
  return { startISO: start.toISOString(), endISO: end.toISOString() }
}

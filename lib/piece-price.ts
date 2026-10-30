// A piece's price in paise. null = not for sale (gated blocks stay members-only).
export const MIN_PIECE_PRICE_PAISE = 1_000 // ₹10
export const MAX_PIECE_PRICE_PAISE = 1_000_000 // ₹10,000

export function normalizePiecePrice(v: unknown): number | null {
  if (v === null || v === undefined || v === "" || v === 0) return null
  const n = typeof v === "number" ? v : Number.NaN
  if (!Number.isInteger(n) || n < MIN_PIECE_PRICE_PAISE || n > MAX_PIECE_PRICE_PAISE)
    throw new Error(`Price must be between ₹${MIN_PIECE_PRICE_PAISE / 100} and ₹${MAX_PIECE_PRICE_PAISE / 100}.`)
  return n
}

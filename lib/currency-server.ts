import { FX_PPP, FX_MARKET, type CurrencyCode } from "./currency-data"

// Server utility to calculate the exact subunit amount to pass to Razorpay.
export function getServerLocalAmount(paise: number, code: CurrencyCode, isPPP: boolean): number {
  const table = isPPP ? FX_PPP : FX_MARKET
  const fx = table[code] ?? table.INR
  let amount = (paise / 100) * fx.rate
  
  if (isPPP) {
    amount = Math.ceil(amount)
  } else {
    amount = Number(amount.toFixed(2)) // Market rounding precision
  }
  
  // Razorpay expects subunit (cents/paise) EXCEPT for zero-decimal currencies like JPY.
  const multiplier = code === "JPY" ? 1 : 100
  return Math.round(amount * multiplier)
}

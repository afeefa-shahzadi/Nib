// FX_PPP: Purchasing Power Parity (PPP) conversion rates.
// Used for Platform Pricing and Subscriptions (digital goods with 0 marginal cost).
// Reflects how much 1 INR feels like in foreign purchasing power.
export const FX_PPP: Record<
  string,
  { symbol: string; rate: number; label: string; locale: string }
> = {
  INR: { symbol: "₹", rate: 1, label: "Indian Rupee", locale: "en-IN" },
  USD: { symbol: "$", rate: 0.049, label: "US Dollar", locale: "en-US" },
  EUR: { symbol: "€", rate: 0.0325, label: "Euro", locale: "de-DE" },
  GBP: { symbol: "£", rate: 0.0325, label: "British Pound", locale: "en-GB" },
  AED: { symbol: "د.إ", rate: 0.1141, label: "UAE Dirham", locale: "ar-AE" },
  SGD: { symbol: "S$", rate: 0.0394, label: "Singapore Dollar", locale: "en-SG" },
  AUD: { symbol: "A$", rate: 0.0669, label: "Australian Dollar", locale: "en-AU" },
  CAD: { symbol: "C$", rate: 0.0563, label: "Canadian Dollar", locale: "en-CA" },
  JPY: { symbol: "¥", rate: 4.6255, label: "Japanese Yen", locale: "ja-JP" },
  CHF: { symbol: "CHF", rate: 0.0476, label: "Swiss Franc", locale: "de-CH" },
  NZD: { symbol: "NZ$", rate: 0.0717, label: "New Zealand Dollar", locale: "en-NZ" },
  SEK: { symbol: "kr", rate: 0.4158, label: "Swedish Krona", locale: "sv-SE" },
  NOK: { symbol: "kr", rate: 0.4477, label: "Norwegian Krone", locale: "nb-NO" },
  MXN: { symbol: "$", rate: 0.4856, label: "Mexican Peso", locale: "es-MX" },
  BRL: { symbol: "R$", rate: 0.1218, label: "Brazilian Real", locale: "pt-BR" },
  ZAR: { symbol: "R", rate: 0.3639, label: "South African Rand", locale: "en-ZA" },
}

// FX_MARKET: Live Market Exchange Rates.
// Used for Payouts, Earnings, Leaderboards, Tips, and Sponsorships.
// Ensures 1:1 real value transfer avoiding arbitrage.
export const FX_MARKET: Record<
  string,
  { symbol: string; rate: number; label: string; locale: string }
> = {
  INR: { symbol: "₹", rate: 1, label: "Indian Rupee", locale: "en-IN" },
  USD: { symbol: "$", rate: 0.010547, label: "US Dollar", locale: "en-US" },
  EUR: { symbol: "€", rate: 0.00927, label: "Euro", locale: "de-DE" },
  GBP: { symbol: "£", rate: 0.007991, label: "British Pound", locale: "en-GB" },
  AED: { symbol: "د.إ", rate: 0.038734, label: "UAE Dirham", locale: "ar-AE" },
  SGD: { symbol: "S$", rate: 0.013681, label: "Singapore Dollar", locale: "en-SG" },
  AUD: { symbol: "A$", rate: 0.015234, label: "Australian Dollar", locale: "en-AU" },
  CAD: { symbol: "C$", rate: 0.014981, label: "Canadian Dollar", locale: "en-CA" },
  JPY: { symbol: "¥", rate: 1.704896, label: "Japanese Yen", locale: "ja-JP" },
  CHF: { symbol: "CHF", rate: 0.008545, label: "Swiss Franc", locale: "de-CH" },
  NZD: { symbol: "NZ$", rate: 0.018593, label: "New Zealand Dollar", locale: "en-NZ" },
  SEK: { symbol: "kr", rate: 0.102555, label: "Swedish Krona", locale: "sv-SE" },
  NOK: { symbol: "kr", rate: 0.10322, label: "Norwegian Krone", locale: "nb-NO" },
  MXN: { symbol: "$", rate: 0.185139, label: "Mexican Peso", locale: "es-MX" },
  BRL: { symbol: "R$", rate: 0.054649, label: "Brazilian Real", locale: "pt-BR" },
  ZAR: { symbol: "R", rate: 0.174259, label: "South African Rand", locale: "en-ZA" },
}

export type CurrencyCode = keyof typeof FX_PPP

export const IP_PER_RUPEE = 100 // 100 IP = ₹1
export const PAYOUT_MIN_INR = 400 // ₹400 minimum payout

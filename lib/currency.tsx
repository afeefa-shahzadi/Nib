"use client"
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { FX_PPP, FX_MARKET, type CurrencyCode } from "./currency-data"

export * from "./currency-data"

function detectFromTimezone(): CurrencyCode {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""
    if (tz.startsWith("Asia/Kolkata") || tz.startsWith("Asia/Calcutta"))
      return "INR"
    if (tz.startsWith("America/")) {
      if (tz.includes("Toronto") || tz.includes("Vancouver")) return "CAD"
      if (tz.includes("Mexico")) return "MXN"
      if (tz.includes("Sao_Paulo") || tz.includes("Fortaleza")) return "BRL"
      return "USD"
    }
    if (tz.startsWith("Europe/London")) return "GBP"
    if (tz.startsWith("Europe/Zurich")) return "CHF"
    if (tz.startsWith("Europe/Stockholm")) return "SEK"
    if (tz.startsWith("Europe/Oslo")) return "NOK"
    if (tz.startsWith("Europe/")) return "EUR"
    if (tz.startsWith("Asia/Dubai")) return "AED"
    if (tz.startsWith("Asia/Singapore")) return "SGD"
    if (tz.startsWith("Australia/")) return "AUD"
    if (tz.startsWith("Pacific/Auckland")) return "NZD"
    if (tz.startsWith("Asia/Tokyo")) return "JPY"
    if (tz.startsWith("Africa/Johannesburg")) return "ZAR"
  } catch {}
  return "INR"
}

type Ctx = { code: CurrencyCode; set: (c: CurrencyCode) => void }
const CurrencyCtx = createContext<Ctx>({ code: "INR", set: () => {} })

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<CurrencyCode>("INR")
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = (typeof window !== "undefined" &&
        localStorage.getItem("currency")) as CurrencyCode | null
      setCode(saved && FX_PPP[saved] ? saved : detectFromTimezone())
    })
    return () => cancelAnimationFrame(frame)
  }, [])
  const set = (c: CurrencyCode) => {
    setCode(c)
    try {
      localStorage.setItem("currency", c)
    } catch {}
  }
  const value = useMemo(() => ({ code, set }), [code])
  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>
}

export function useCurrency() {
  return useContext(CurrencyCtx)
}

function formatBase(rupees: number, code: CurrencyCode, fxTable: typeof FX_PPP, rounding: "ceil" | "round" | "none" = "none"): string {
  const fx = fxTable[code] ?? fxTable.INR
  let amount = rupees * fx.rate
  
  if (rounding === "ceil") amount = Math.ceil(amount)
  else if (rounding === "round") amount = Math.round(amount)

  const fraction = (code === "JPY" || rounding !== "none") ? 0 : 2
  try {
    return new Intl.NumberFormat(fx.locale, {
      style: "currency",
      currency: code,
      maximumFractionDigits: fraction,
      minimumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${fx.symbol}${amount.toFixed(fraction)}`
  }
}

// Used ONLY for pricing pages, subscription checkouts, and platform purchases.
export function formatINRPPP(rupees: number, code: CurrencyCode = "INR"): string {
  return formatBase(rupees, code, FX_PPP, "ceil")
}

// Used for earnings, tips, leaderboards, and real money movement.
export function formatINRMarket(rupees: number, code: CurrencyCode = "INR"): string {
  return formatBase(rupees, code, FX_MARKET)
}

// Paise represents user earnings, which MUST be market exchange rates.
export function formatPaiseMarket(paise: number, code: CurrencyCode = "INR"): string {
  return formatINRMarket(paise / 100, code)
}

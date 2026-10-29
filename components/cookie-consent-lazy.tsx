"use client"

import dynamic from "next/dynamic"

// The banner only mounts after a 1s delay; keep its dialog/switch code out of the first-load bundle.
const CookieConsent = dynamic(() => import("./cookie-consent").then((m) => m.CookieConsent), { ssr: false })

export function CookieConsentLazy() {
  return <CookieConsent />
}

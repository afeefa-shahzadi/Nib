"use client"
import { useCallback, useEffect } from "react"

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void }
  }
}

type RazorpayOptions = {
  key: string
  amount?: number
  currency?: string
  name: string
  description?: string
  order_id?: string
  subscription_id?: string
  handler: (response: {
    razorpay_order_id?: string
    razorpay_payment_id: string
    razorpay_signature?: string
    razorpay_subscription_id?: string
  }) => void
  prefill?: { name?: string; email?: string }
  theme?: { color?: string }
  modal?: { ondismiss?: () => void }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js"

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false)
    if (window.Razorpay) return resolve(true)
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`
    )
    if (existing) {
      existing.addEventListener("load", () => resolve(!!window.Razorpay), {
        once: true,
      })
      return
    }
    const s = document.createElement("script")
    s.src = SCRIPT_SRC
    s.async = true
    s.onload = () => resolve(!!window.Razorpay)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

export function useRazorpayCheckout() {

  useEffect(() => {
    // We intentionally do NOT preload the Razorpay script here by default
    // to avoid unnecessary network requests on page load.
    // It will be loaded on demand when openCheckout is called.
  }, [])

  const openCheckout = useCallback(async (options: RazorpayOptions) => {
    const ok = await loadRazorpayScript()
    if (!ok || !window.Razorpay) {
      throw new Error(
        "Failed to load Razorpay. Check your network and try again."
      )
    }
    const rz = new window.Razorpay(options)
    rz.open()
  }, [])

  return { openCheckout }
}

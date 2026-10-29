"use client"

import { useEffect } from "react"
import { logError } from "@/actions/errors"

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error("[mycelium global error]", error)

    logError({
      message: error.message || String(error),
      stack: error.stack,
      url: typeof window !== "undefined" ? window.location.href : undefined,
      userAgent:
        typeof window !== "undefined" ? navigator.userAgent : undefined,
    }).catch((err) => {
      console.error("Failed to report global error:", err)
    })
  }, [error])
  return (
    <html lang="en">
      <body className="bg-[oklch(0.18_0.012_60)] font-sans text-[oklch(0.96_0.005_80)] antialiased">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-md space-y-4 text-center">
            <div className="text-5xl">🍄</div>
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="text-sm text-[oklch(0.68_0.012_70)]">
              {error.digest
                ? `Error ID: ${error.digest}`
                : "An unexpected error occurred."}
            </p>
            <button
              onClick={() => unstable_retry()}
              className="inline-flex items-center gap-2 rounded-md bg-[oklch(0.74_0.11_190)] px-4 py-2 text-sm font-medium text-[oklch(0.16_0.012_60)] transition-opacity hover:opacity-90"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}

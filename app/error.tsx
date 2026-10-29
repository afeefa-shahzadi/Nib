"use client"

import { useEffect } from "react"
import Link from "next/link"
import { logError } from "@/actions/errors"

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error("[mycelium]", error)

    logError({
      message: error.message || String(error),
      stack: error.stack,
      url: typeof window !== "undefined" ? window.location.href : undefined,
      userAgent:
        typeof window !== "undefined" ? navigator.userAgent : undefined,
    }).catch((err) => {
      console.error("Failed to report error:", err)
    })
  }, [error])

  return (
    <main className="flex min-h-[80vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="text-5xl" aria-hidden="true">
          ⚠️
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground">
            An unexpected error interrupted this page. Try again — if it keeps
            happening, come back in a little while.
          </p>
          {/* Raw error.message can leak server internals; surface only the
              non-sensitive digest so support can correlate logs. */}
          {error.digest && (
            <p className="text-xs text-muted-foreground">
              Error ID: <span className="font-mono">{error.digest}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => unstable_retry()}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Back home
          </Link>
        </div>
      </div>
    </main>
  )
}

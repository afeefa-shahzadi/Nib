"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { getMyConsentStatus, resendParentalConsent } from "@/actions/parental-consent"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase/client"

// Shown to signed-in 13–17-year-olds until a parent approves their account.
// `initialPending` comes from a server layout; without it, self-fetch.
export function ConsentBanner({ initialPending }: { initialPending?: boolean } = {}) {
  const [pending, setPending] = useState(initialPending ?? false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (initialPending !== undefined) return
    // Guests skip the server round trip.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) getMyConsentStatus().then((s) => setPending(s === "pending")).catch(() => {})
    })
  }, [initialPending])
  if (!pending) return null
  return (
    <div role="status" className="hairline-b bg-note/10">
      <div className="container-wide flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-sm">
        <p className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          Waiting for a parent to approve your account. You can read and follow writers; publishing and posting open once they do.
        </p>
        <Button
          variant="outline"
          className="min-h-11"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await resendParentalConsent()
              toast.success("Sent. Ask your parent to check their inbox.")
            } catch (e) {
              toast.error((e as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          Email my parent again
        </Button>
      </div>
    </div>
  )
}

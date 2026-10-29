"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Cookie, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface CookiePreferences {
  essential: boolean
  analytics: boolean
  marketing: boolean
}

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    marketing: false,
  })

  useEffect(() => {
    // Check if the user has already set preferences
    const stored = localStorage.getItem("cookie_preferences")
    if (!stored) {
      // Small delay to ensure smooth hydration
      const timer = setTimeout(() => setShowBanner(true), 1000)
      return () => clearTimeout(timer)
    } else {
      try {
        const parsed = JSON.parse(stored)
        // Use queueMicrotask to avoid synchronous setState in effect
        queueMicrotask(() => setPreferences(parsed))
      } catch {
        // ignore JSON parse errors
      }
    }
  }, [])

  const savePreferences = (prefs: CookiePreferences) => {
    localStorage.setItem("cookie_preferences", JSON.stringify(prefs))
    setPreferences(prefs)
    setShowBanner(false)
    setShowCustomize(false)
  }

  const acceptAll = () => {
    savePreferences({ essential: true, analytics: true, marketing: true })
  }

  const essentialOnly = () => {
    savePreferences({ essential: true, analytics: false, marketing: false })
  }

  if (!showBanner && !showCustomize) return null

  return (
    <>
      {showBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md animate-in slide-in-from-bottom-full duration-500">
          <div className="rounded-xl border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <Cookie className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground">We value your privacy</h3>
              </div>
              <button
                onClick={() => setShowBanner(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              We use strictly necessary cookies to make our site work. We&apos;d also like to set optional cookies to help us improve it. We won&apos;t set optional cookies unless you enable them.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button onClick={acceptAll} className="w-full sm:w-auto">
                Accept all
              </Button>
              <Button onClick={essentialOnly} variant="outline" className="w-full sm:w-auto">
                Essential only
              </Button>
              <Button
                onClick={() => setShowCustomize(true)}
                variant="ghost"
                className="w-full sm:w-auto text-muted-foreground"
              >
                Customize
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showCustomize} onOpenChange={(open) => !open && setShowCustomize(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Customize Cookie Preferences</DialogTitle>
            <DialogDescription>
              Manage how we use cookies to personalize your experience.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-start justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label className="text-base">Strictly Necessary</Label>
                <p className="text-sm text-muted-foreground">
                  Essential for the website to function. Cannot be switched off.
                </p>
              </div>
              <Switch checked={preferences.essential} disabled />
            </div>
            <div className="flex items-start justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="analytics" className="text-base">Analytics &amp; Performance</Label>
                <p className="text-sm text-muted-foreground">
                  Help us improve our website by collecting and reporting information on how you use it.
                </p>
              </div>
              <Switch
                id="analytics"
                checked={preferences.analytics}
                onCheckedChange={(c) => setPreferences({ ...preferences, analytics: c })}
              />
            </div>
            <div className="flex items-start justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="marketing" className="text-base">Marketing &amp; Personalization</Label>
                <p className="text-sm text-muted-foreground">
                  Used to deliver personalized advertisements and track their performance.
                </p>
              </div>
              <Switch
                id="marketing"
                checked={preferences.marketing}
                onCheckedChange={(c) => setPreferences({ ...preferences, marketing: c })}
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setPreferences({ essential: true, analytics: false, marketing: false })
                savePreferences({ essential: true, analytics: false, marketing: false })
              }}
            >
              Reject all optional
            </Button>
            <Button onClick={() => savePreferences(preferences)}>Save preferences</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

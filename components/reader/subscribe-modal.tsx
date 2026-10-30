"use client"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { useState, useEffect } from "react"
import { subscribeToAuthor } from "@/actions/social"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import Link from "next/link"

const SEEN_KEY = "subscribe_modal_shown"

// sessionStorage can throw (private mode, blocked storage): treat that as "not seen".
function seenThisSession() {
  try {
    return sessionStorage.getItem(SEEN_KEY) !== null
  } catch {
    return false
  }
}
function markSeenThisSession() {
  try {
    sessionStorage.setItem(SEEN_KEY, "1")
  } catch {}
}

interface SubscribeModalProps {
  articleRef: React.RefObject<HTMLElement | null>
  authorId: string
  authorHandle: string
  authorName: string
  authorAvatar?: string | null
}

export function SubscribeModal({ articleRef, authorId, authorName, authorAvatar }: SubscribeModalProps) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Guest-capture modal ("Join Nib for free / Create account"). Logged-in readers
    // already have an account and get the inline SubscribeCard instead.
    let active = true
    let onScroll: (() => void) | null = null
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active || session?.user || seenThisSession()) return
      // Only after the reader is clearly reading: 60% of the article scrolled into view.
      onScroll = () => {
        const el = articleRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        if ((window.innerHeight - r.top) / r.height < 0.6) return
        window.removeEventListener("scroll", onScroll!)
        // Re-check: the reader may have signed in (e.g. in another tab) since the page loaded.
        supabase.auth.getSession().then(({ data: { session: now } }) => {
          if (!active || now?.user || seenThisSession()) return
          markSeenThisSession()
          setOpen(true)
        })
      }
      window.addEventListener("scroll", onScroll, { passive: true })
    })
    return () => {
      active = false
      if (onScroll) window.removeEventListener("scroll", onScroll)
    }
  }, [articleRef])

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !email.includes("@")) {
      toast.error("Enter a valid email address.")
      return
    }
    setLoading(true)
    const { ok, message, error } = await subscribeToAuthor({ author_id: authorId, email })
    setLoading(false)
    
    if (ok) {
      toast.success(message)
      setOpen(false)
    } else {
      toast.error(error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-106.25 p-8 bg-popover text-popover-foreground">
        <DialogTitle className="sr-only">Subscribe to {authorName}</DialogTitle>
        <DialogDescription className="sr-only">Get updates from {authorName} sent right to your inbox.</DialogDescription>
        <div className="flex flex-col items-center text-center space-y-6">
          <Avatar className="size-16">
            <AvatarImage src={authorAvatar || ""} />
            <AvatarFallback>{authorName.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          
          <div className="space-y-2">
            <h2 className="font-display text-2xl tracking-tight">
              Enjoying {authorName}&apos;s writing?
            </h2>
            <p className="text-sm text-muted-foreground">
              Get new pieces from {authorName} by email. Free, and you can unsubscribe any time.
            </p>
          </div>

          <form onSubmit={handleSubscribe} className="w-full space-y-4">
            <div className="space-y-2 text-left">
              <Label htmlFor="email">Your email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={loading}
            >
              {loading ? "Subscribing…" : "Subscribe"}
            </Button>
          </form>

          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              Already have an account?{" "}
              <Link href="/login" className="text-foreground hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

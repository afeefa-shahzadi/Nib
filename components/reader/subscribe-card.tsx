"use client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { subscribeToAuthor } from "@/actions/social"
import { toast } from "sonner"

interface SubscribeCardProps {
  authorId: string
  authorName: string
  /** Sidebar version: left-aligned, no rules, smaller heading. */
  compact?: boolean
}

export function SubscribeCard({ authorId, authorName, compact }: SubscribeCardProps) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !email.includes("@")) {
      toast.error("Please enter a valid email")
      return
    }
    setLoading(true)
    const { ok, message, error } = await subscribeToAuthor({ author_id: authorId, email })
    setLoading(false)
    
    if (ok) {
      toast.success(message)
      setSubscribed(true)
    } else {
      toast.error(error)
    }
  }

  if (subscribed && compact) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Subscribed. New pieces by {authorName} will arrive by email.
      </p>
    )
  }

  if (compact) {
    return (
      <form onSubmit={handleSubscribe} className="space-y-2">
        <label htmlFor="profile-subscribe" className="block text-sm font-medium">
          Get new pieces by email
        </label>
        <div className="flex gap-2">
          <Input
            id="profile-subscribe"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" variant="outline" disabled={loading}>
            {loading ? "…" : "Subscribe"}
          </Button>
        </div>
      </form>
    )
  }

  if (subscribed) {
    return (
      <div className="my-8 py-8 border-y border-border text-center">
        <h3 className="text-xl font-serif text-foreground mb-2">
          Thank you for subscribing!
        </h3>
        <p className="text-sm text-muted-foreground">
          You&apos;ll receive {authorName}&apos;s stories in your inbox.
        </p>
      </div>
    )
  }

  return (
    <div className="my-8 py-8 border-y border-border text-center bg-background">
      <h2 className="text-2xl font-serif text-foreground mb-2 tracking-tight">
        Get {authorName}&apos;s stories in your inbox
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Join Nib for free to get updates from this writer.
      </p>

      <form onSubmit={handleSubscribe} className="max-w-md mx-auto flex flex-col sm:flex-row gap-0 rounded-md overflow-hidden border border-border shadow-sm">
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-4 h-12 flex-1"
          required
        />
        <Button 
          type="submit" 
          className="rounded-none h-12 px-8 font-semibold"
          disabled={loading}
        >
          {loading ? "Subscribing..." : "Subscribe"}
        </Button>
      </form>
    </div>
  )
}

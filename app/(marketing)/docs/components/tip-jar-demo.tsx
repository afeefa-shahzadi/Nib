"use client"
import { useState } from "react"
import { Heart, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function TipJarDemo() {
  const [amount, setAmount] = useState(99)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = () => {
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than ₹0.")
      toast.error("Invalid amount")
      return
    }
    if (amount > 100000) {
      setError("Demo cap is ₹1,00,000.")
      toast.error("Too large for the demo")
      return
    }
    setError(null)
    setSent(true)
    toast.success(`Demo tip of ₹${amount} sent`)
  }

  if (sent) {
    return (
      <div
        className="surface-elevated rounded-xl border border-primary/40 p-8 text-center"
        role="status"
        aria-live="polite"
      >
        <Heart
          className="mx-auto mb-3 size-6 fill-primary text-primary"
          aria-hidden
        />
        <p className="font-display text-xl">Demo tip of ₹{amount} sent.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          For real, Razorpay takes the payment and it&apos;s credited to the
          author&apos;s earnings balance.
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="mt-4"
          onClick={() => setSent(false)}
        >
          <RotateCcw className="mr-1 size-3" /> Reset
        </Button>
      </div>
    )
  }
  return (
    <div className="surface-elevated rounded-xl border border-border/60 p-6">
      <p className="mb-2 text-xs tracking-wider text-primary uppercase">
        Tip jar
      </p>
      <p className="mb-4 font-display text-xl">Liked this? Send a tip.</p>
      <div className="mb-4 flex gap-2" role="group" aria-label="Quick amounts">
        {[49, 99, 199, 499].map((v) => (
          <button
            key={v}
            onClick={() => setAmount(v)}
            aria-pressed={amount === v}
            className={`flex-1 rounded-md border py-2 text-sm transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none ${
              amount === v
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            ₹{v}
          </button>
        ))}
      </div>
      <label htmlFor="tip-amount" className="sr-only">
        Custom amount in rupees
      </label>
      <Input
        id="tip-amount"
        type="number"
        min={1}
        value={amount}
        onChange={(e) => {
          setAmount(+e.target.value || 0)
          setError(null)
        }}
        onKeyDown={(e) => e.key === "Enter" && send()}
        aria-invalid={!!error}
        aria-describedby={error ? "tip-error" : undefined}
        className="mb-2"
      />
      {error && (
        <p
          id="tip-error"
          role="alert"
          className="mb-2 text-xs text-destructive"
        >
          {error}
        </p>
      )}
      <Button className="w-full" onClick={send}>
        <Heart className="mr-2 size-4" /> Send ₹{amount}
      </Button>
    </div>
  )
}

import Link from "next/link"

/**
 * Point-of-sale disclosure shown next to any pay/subscribe button. A disclosure
 * line (not a blocking checkbox) is the standard, low-friction way to record
 * consent at checkout without hurting conversion on repeat payments like tips.
 */
export function PaymentConsentNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted-foreground ${className}`}>
      By continuing you agree to our{" "}
      <Link href="/terms" target="_blank" className="underline hover:text-foreground">
        Terms, including the refund policy
      </Link>
      . Payments are processed by Razorpay.
    </p>
  )
}

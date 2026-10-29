import { redirect } from "next/navigation"
import { Banknote } from "lucide-react"
import { getMyRole } from "@/actions/content/profile"
import { listPendingPayouts, getTaxSummary } from "@/actions/admin/payouts"
import { razorpayxConfigured } from "@/lib/razorpayx/client"
import { PayoutQueue } from "./payout-queue"

function rs(p: number) {
  return `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}

export default async function PayoutsPage() {
  const { primary } = await getMyRole()
  if (primary !== "admin") redirect("/")

  const [payouts, tax] = await Promise.all([
    listPendingPayouts(),
    getTaxSummary(),
  ])
  const rzxConfigured = razorpayxConfigured()

  return (
    <div className="mx-auto w-full max-w-350 p-6 md:p-8">
      <header className="mb-6">
        <p className="mb-2 inline-flex items-center gap-2 text-xs tracking-[0.2em] text-muted-foreground uppercase">
          <Banknote className="size-3.5" /> Admin
        </p>
        <h1 className="font-display text-3xl tracking-tight">Payout queue</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {rzxConfigured
            ? "Approve a payout to disburse it via RazorpayX; the webhook marks it paid or failed. You can still settle manually if a payout needs it."
            : "Pay each creator out-of-band to their destination, then record the result here. Marking failed returns the funds to their balance."}
        </p>
      </header>

      <div className="hairline mb-6 rounded-lg px-4 py-3">
        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
          {tax.quarter} — for your CA
        </p>
        <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-sm">
          <span>
            Platform fee <strong>{rs(tax.feePaise)}</strong>
          </span>
          <span>
            GST on fee (18%, output liability){" "}
            <strong>{rs(tax.gstOnFeePaise)}</strong>
          </span>
          <span>
            TDS withheld (194-O) <strong>{rs(tax.tdsWithheldPaise)}</strong>
          </span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Estimates for filing, not advice. Reader-Pass pool cut is taken
          upstream and excluded — your CA adds it from pool volume.
        </p>
      </div>

      <PayoutQueue payouts={payouts} rzxConfigured={rzxConfigured} />
    </div>
  )
}

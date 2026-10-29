"use client"
import { useState } from "react"
import { Check, X } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { COMPARE } from "@/lib/content/pricing/data"

// Phones: pick one plan and read its features as a list, instead of a 7-column table.
export function CompareMobile({ plans }: { plans: string[] }) {
  const [i, setI] = useState(1) // Free
  return (
    <div className="lg:hidden">
      <Label htmlFor="compare-plan" className="text-muted-foreground">Plan</Label>
      <Select value={String(i)} onValueChange={(v) => setI(Number(v))}>
        <SelectTrigger id="compare-plan" className="mt-2 h-11 w-full text-base">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {plans.map((p, idx) => (
            <SelectItem key={p} value={String(idx)} className="min-h-11">
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ul className="mt-6">
        {COMPARE.map(([feat, ...vals]) => {
          const v = (vals as (boolean | string)[])[i]
          const on = v !== false && v !== "—"
          return (
            <li key={feat as string} className="hairline-t flex min-h-12 items-center justify-between gap-4 py-3 last:hairline-b">
              <span className={on ? "text-foreground" : "text-muted-foreground"}>{feat as string}</span>
              {typeof v === "string" ? (
                <span className="shrink-0 text-right font-medium">{v}</span>
              ) : v ? (
                <Check aria-label="Included" className="size-5 shrink-0 text-primary" />
              ) : (
                <X aria-label="Not included" className="size-5 shrink-0 text-muted-foreground/50" />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

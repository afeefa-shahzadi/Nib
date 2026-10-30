"use client"

import { FX_PPP, useCurrency, type CurrencyCode } from "@/lib/currency"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function CurrencySelector({ className = "" }: { className?: string }) {
  const { code, set } = useCurrency()
  return (
    <div
      className={`inline-flex items-center gap-2 text-xs text-muted-foreground ${className}`}
    >
      <Select value={code} onValueChange={(val) => set(val as CurrencyCode)}>
        <SelectTrigger aria-label="Currency" className="h-11 w-24 text-sm focus:ring-1 lg:h-8">
          <SelectValue placeholder="Currency" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(FX_PPP).map(([c, info]) => (
            <SelectItem key={c} value={c} className="min-h-11 text-sm lg:min-h-8">
              {c} · {info.symbol}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

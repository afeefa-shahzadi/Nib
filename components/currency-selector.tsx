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
      <span className="hidden sm:inline">Currency</span>
      <Select value={code} onValueChange={(val) => set(val as CurrencyCode)}>
        <SelectTrigger aria-label="Currency" className="h-7 w-22.5 text-xs focus:ring-1">
          <SelectValue placeholder="Currency" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(FX_PPP).map(([c, info]) => (
            <SelectItem key={c} value={c} className="text-xs">
              {c} · {info.symbol}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

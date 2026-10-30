"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CurrencySelector } from "@/components/currency-selector"
import { useCurrency, formatPaiseMarket } from "@/lib/currency"

export function Money({ paise }: { paise: number }) {
  const { code } = useCurrency()
  return <>{formatPaiseMarket(paise, code)}</>
}

// Every choice lives in the URL so a ranking can be shared or bookmarked.
export function LeaderboardControls({
  who,
  by,
  period,
  q,
  money,
  boards,
}: {
  who: string
  by: string
  period: string
  q: string
  money: boolean
  boards: { value: string; label: string }[]
}) {
  const router = useRouter()
  const params = useSearchParams()
  const go = (set: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(set)) if (v) p.set(k, v); else p.delete(k)
    // Any new choice starts from the top of the default order.
    for (const k of ["page", "sort", "dir"]) p.delete(k)
    const s = p.toString()
    router.push(s ? `/leaderboard?${s}` : "/leaderboard", { scroll: false })
  }

  return (
    <div className="mt-8 space-y-4">
      <Tabs value={who} onValueChange={(v) => go({ who: v === "writers" ? null : v, by: null })}>
        <TabsList>
          <TabsTrigger value="writers">Writers</TabsTrigger>
          <TabsTrigger value="readers">Readers</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="lb-by">Rank by</Label>
          <Select value={by} onValueChange={(v) => go({ by: v === boards[0].value ? null : v })}>
            <SelectTrigger id="lb-by" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {boards.map((b) => (
                <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lb-period">Period</Label>
          <Select value={period} onValueChange={(v) => go({ period: v === "all" ? null : v })}>
            <SelectTrigger id="lb-period" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <form
        role="search"
        className="relative"
        onSubmit={(e) => {
          e.preventDefault()
          go({ q: String(new FormData(e.currentTarget).get("q") ?? "").trim() || null })
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input key={q} name="q" type="search" defaultValue={q} aria-label="Search members" placeholder="Search members" className="pl-9" />
      </form>
      {money && <CurrencySelector />}
    </div>
  )
}

"use client"

import { useEffect, useState, useTransition } from "react"
import { Sparkles, Check } from "lucide-react"
import { toast } from "sonner"
import { FLAIRS } from "@/lib/flair"
import { getFlairState, setFlair } from "@/actions/cosmetics"
import { formatCompactNumber } from "@/lib/utils"

export function FlairShop() {
  const [balance, setBalance] = useState(0)
  const [owned, setOwned] = useState<string[]>([])
  const [equipped, setEquipped] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const refresh = () =>
    getFlairState()
      .then((s) => {
        setBalance(s.balance)
        setOwned(s.owned)
        setEquipped(s.equipped)
      })
      .catch(() => {})

  useEffect(() => {
    refresh()
  }, [])

  const choose = (id: string) => {
    const target = equipped === id ? null : id // click the equipped one to remove it
    startTransition(async () => {
      const res = await setFlair(target)
      if (res.ok) {
        if ("spent" in res && res.spent) toast.success(`Flair unlocked — ${res.spent} IP spent.`)
        await refresh()
      } else if (res.reason === "insufficient_points") {
        toast.error(`Not enough IP. Need ${res.cost}, you have ${formatCompactNumber(res.balance)}.`)
      } else {
        toast.error("Couldn't update flair.")
      }
    })
  }

  return (
    <section className="surface mt-10 rounded-md p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg">
          <Sparkles className="size-4 text-primary" /> Flair shop
        </h2>
        <span className="text-xs text-muted-foreground">
          {formatCompactNumber(balance)} IP to spend
        </span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Spend Insight Points on a name colour. Buy once, equip any time — click your
        equipped flair to remove it.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {FLAIRS.map((f) => {
          const isOwned = owned.includes(f.id)
          const isEquipped = equipped === f.id
          const canAfford = isOwned || balance >= f.cost
          return (
            <button
              key={f.id}
              onClick={() => choose(f.id)}
              disabled={pending || (!isOwned && !canAfford)}
              className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-left text-sm transition disabled:opacity-50 ${
                isEquipped ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/40"
              }`}
            >
              <span className={`font-medium ${f.className}`}>{f.name}</span>
              {isEquipped ? (
                <span className="inline-flex items-center gap-1 text-xs text-primary">
                  <Check className="size-3.5" /> On
                </span>
              ) : isOwned ? (
                <span className="text-xs text-muted-foreground">Equip</span>
              ) : (
                <span className="text-xs text-muted-foreground">{f.cost} IP</span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

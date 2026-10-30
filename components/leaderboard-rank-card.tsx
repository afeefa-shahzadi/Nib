"use client"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { Trophy } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { myLeaderboardRank } from "@/actions/leaderboard"
import { useCurrency, formatPaiseMarket } from "@/lib/currency"
import { formatCompactNumber } from "@/lib/utils"
import { useMyPlan } from "@/hooks/use-my-plan"

export function LeaderboardRankCard({
  audience,
}: {
  audience: "author" | "reader"
}) {
  const [uid, setUid] = useState<string | null>(null)
  const { code } = useCurrency()
  const { launchFree } = useMyPlan()
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null))
  }, [])
  const fn = myLeaderboardRank
  const { data } = useQuery({
    queryKey: ["my-lb-rank", uid],
    queryFn: () => fn({ data: { userId: uid! } }),
    enabled: !!uid,
    staleTime: 60_000,
  })

  const row = audience === "author" ? data?.author : data?.reader

  return (
    <Link
      href="/leaderboard"
      className="surface block rounded-lg p-4 transition hover:border-primary/40"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Trophy className="size-4 text-note" />
          Your rank
        </div>
        <span className="text-sm text-muted-foreground">View board</span>
      </div>
      {row ? (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-display text-3xl">#{row.rank}</span>
          <span className="text-sm text-muted-foreground">of {row.total}</span>
        </div>
      ) : (
        <div className="mt-2 font-display text-xl text-muted-foreground">
          Unranked
        </div>
      )}
      <p className="mt-1 text-sm text-muted-foreground">
        {audience === "author"
          ? row && data?.author
            ? `${formatCompactNumber(data.author.followers)} followers${launchFree ? "" : ` · ${formatPaiseMarket(data.author.earningsPaise, code)} earned`}`
            : "Publish a piece to enter the author board."
          : row && data?.reader
            ? `${formatCompactNumber(data.reader.points)} insight pts`
            : "Read, clap, or annotate to enter the reader board."}
      </p>
    </Link>
  )
}

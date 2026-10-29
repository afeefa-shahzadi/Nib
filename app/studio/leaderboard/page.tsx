"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import Image from "next/image"
import { monthlyLeaderboard, streakLeaderboard } from "@/actions/monetization"
import { Trophy, Medal, Star, User, Search, ChevronLeft, ChevronRight, Flame, Crown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCompactNumber } from "@/lib/utils"

type XpEntry = NonNullable<Awaited<ReturnType<typeof monthlyLeaderboard>>>["entries"][number]
type StreakEntry = NonNullable<Awaited<ReturnType<typeof streakLeaderboard>>>["entries"][number]

const PAGE_SIZE = 10

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
        active ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  )
}

function RankCell({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="mx-auto size-6 text-note" />
  if (rank === 2) return <Medal className="mx-auto size-6 text-muted-foreground" />
  if (rank === 3) return <Medal className="mx-auto size-6 text-warn" />
  return <span className="text-muted-foreground">{rank}</span>
}

function Avatar({ url, name }: { url?: string | null; name: string }) {
  if (url) {
    return (
      <Image
        unoptimized
        width={40}
        height={40}
        src={url}
        alt={name}
        className="size-10 rounded-full border border-border/50 object-cover shrink-0"
      />
    )
  }
  return (
    <div className="flex size-10 items-center justify-center rounded-full border border-border/50 bg-muted shrink-0">
      <User className="size-5 text-muted-foreground" />
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number
  totalPages: number
  total: number
  onPage: (n: number) => void
}) {
  if (totalPages <= 1) return null
  const start = (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, total)
  return (
    <div className="flex items-center justify-between border-t border-border/50 bg-muted/10 px-6 py-3">
      <div className="text-xs text-muted-foreground">
        Showing {start}–{end} of {total}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onPage(page - 1)} disabled={page === 1}>
          <ChevronLeft className="size-4" />
          <span className="sr-only">Previous</span>
        </Button>
        <div className="text-sm font-medium">
          Page {page} of {totalPages}
        </div>
        <Button variant="outline" size="sm" onClick={() => onPage(page + 1)} disabled={page === totalPages}>
          <ChevronRight className="size-4" />
          <span className="sr-only">Next</span>
        </Button>
      </div>
    </div>
  )
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<"xp" | "streak">("xp")

  // XP leaderboard state
  const [xpData, setXpData] = useState<XpEntry[] | null>(null)
  const [xpLoading, setXpLoading] = useState(true)
  const [levelFilter, setLevelFilter] = useState("all")

  // Streak leaderboard state
  const [streakData, setStreakData] = useState<StreakEntry[] | null>(null)
  const [streakLoading, setStreakLoading] = useState(false)

  // Shared
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  // Load XP leaderboard on mount
  useEffect(() => {
    monthlyLeaderboard()
      .then((d) => setXpData(d?.entries ?? []))
      .catch(console.error)
      .finally(() => setXpLoading(false))
  }, [])

  // Load streak leaderboard lazily when tab is activated
  const loadStreak = useCallback(() => {
    if (streakData !== null) return
    setStreakLoading(true)
    streakLeaderboard()
      .then((d) => setStreakData(d?.entries ?? []))
      .catch(console.error)
      .finally(() => setStreakLoading(false))
  }, [streakData])

  useEffect(() => {
    if (tab === "streak") queueMicrotask(() => loadStreak())
  }, [tab, loadStreak])

  // Reset pagination when switching or filtering
  const resetPage = () => setPage(1)

  const handleSearch = (v: string) => { setSearch(v); resetPage() }
  const handleLevel = (v: string) => { setLevelFilter(v); resetPage() }
  const handleTab = (t: "xp" | "streak") => { setTab(t); resetPage(); setSearch(""); setLevelFilter("all") }

  // --- XP filtered entries ---
  const filteredXp = useMemo(() => {
    const entries = xpData ?? []
    return entries.filter((e) => {
      const q = search.toLowerCase()
      const matchName = e.displayName.toLowerCase().includes(q) || (e.handle ?? "").toLowerCase().includes(q)
      let matchLevel = true
      if (levelFilter === "low") matchLevel = e.level < 5
      else if (levelFilter === "mid") matchLevel = e.level >= 5 && e.level < 15
      else if (levelFilter === "high") matchLevel = e.level >= 15
      return matchName && matchLevel
    })
  }, [xpData, search, levelFilter])

  const xpPages = Math.max(1, Math.ceil(filteredXp.length / PAGE_SIZE))
  const pagedXp = filteredXp.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // --- Streak filtered entries ---
  const filteredStreak = useMemo(() => {
    const entries = streakData ?? []
    const q = search.toLowerCase()
    return entries.filter((e) =>
      e.displayName.toLowerCase().includes(q) || (e.handle ?? "").toLowerCase().includes(q)
    )
  }, [streakData, search])

  const streakPages = Math.max(1, Math.ceil(filteredStreak.length / PAGE_SIZE))
  const pagedStreak = filteredStreak.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const isLoading = tab === "xp" ? xpLoading : streakLoading

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 p-6 md:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl flex items-center gap-3">
          <Trophy className="size-8 text-note" /> Leaderboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Top authors and readers ranked by XP earned or daily streaks maintained.
        </p>
      </header>

      {/* Tab Bar */}
      <div className="flex gap-1 rounded-xl border border-border/50 bg-muted/40 p-1 w-fit">
        <TabBtn active={tab === "xp"} onClick={() => handleTab("xp")} label={<span className="flex items-center gap-1.5"><Star className="size-3.5 fill-primary text-primary" /> XP Ranking</span>} />
        <TabBtn active={tab === "streak"} onClick={() => handleTab("streak")} label={<span className="flex items-center gap-1.5"><Flame className="size-3.5 text-warn" /> Streaks</span>} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or handle…"
            className="pl-9"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        {tab === "xp" && (
          <div className="w-full sm:w-48">
            <Select value={levelFilter} onValueChange={handleLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="low">Levels 1–4</SelectItem>
                <SelectItem value="mid">Levels 5–14</SelectItem>
                <SelectItem value="high">Level 15+</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="surface overflow-hidden rounded-2xl border border-border/50 shadow-sm">
        {tab === "xp" && (
          <>
            <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b border-border/50 bg-muted/30 px-6 py-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <div className="w-12 text-center">Rank</div>
              <div>User</div>
              <div className="w-20 text-center">Level</div>
              <div className="w-24 text-right">XP</div>
            </div>

            <div className="divide-y divide-border/50">
              {isLoading ? (
                <div className="px-6 py-12 text-center text-sm text-muted-foreground animate-pulse">
                  Loading ranks…
                </div>
              ) : pagedXp.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                  {search || levelFilter !== "all" ? "No users match your filters." : "No data yet. Complete quests to appear here!"}
                </div>
              ) : (
                pagedXp.map((entry) => (
                  <div
                    key={entry.userId}
                    className={`grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50 ${entry.rank <= 3 ? "bg-note/5" : ""}`}
                  >
                    <div className="w-12 text-center font-display text-lg font-bold">
                      <RankCell rank={entry.rank} />
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar url={entry.avatarUrl} name={entry.displayName} />
                      <div className="min-w-0 truncate">
                        <div className="font-medium truncate">{entry.displayName}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          @{entry.handle || `user_${entry.userId.slice(0, 5)}`}
                        </div>
                      </div>
                    </div>
                    <div className="w-20 text-center">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        <Star className="size-3 fill-primary" /> {entry.level}
                      </div>
                    </div>
                    <div className="w-24 text-right font-display text-lg font-bold">
                      {formatCompactNumber(entry.points)}
                    </div>
                  </div>
                ))
              )}
            </div>

            <Pagination page={page} totalPages={xpPages} total={filteredXp.length} onPage={setPage} />
          </>
        )}

        {tab === "streak" && (
          <>
            <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b border-border/50 bg-muted/30 px-6 py-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <div className="w-12 text-center">Rank</div>
              <div>User</div>
              <div className="w-28 text-center">Best Streak</div>
              <div className="w-28 text-right">Current 🔥</div>
            </div>

            <div className="divide-y divide-border/50">
              {isLoading ? (
                <div className="px-6 py-12 text-center text-sm text-muted-foreground animate-pulse">
                  Loading streaks…
                </div>
              ) : pagedStreak.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                  {search ? "No users match your search." : "No streak data yet. Open Studio every day to build your streak!"}
                </div>
              ) : (
                pagedStreak.map((entry) => (
                  <div
                    key={entry.userId}
                    className={`grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50 ${entry.rank <= 3 ? "bg-warn/5" : ""}`}
                  >
                    <div className="w-12 text-center font-display text-lg font-bold">
                      <RankCell rank={entry.rank} />
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar url={entry.avatarUrl} name={entry.displayName} />
                      <div className="min-w-0 truncate">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium truncate">{entry.displayName}</span>
                          {entry.isActiveToday && (
                            <span className="shrink-0 rounded-full bg-warn/10 px-1.5 py-0.5 text-[10px] font-medium text-warn">
                              Active today
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          @{entry.handle || `user_${entry.userId.slice(0, 5)}`}
                        </div>
                      </div>
                    </div>
                    <div className="w-28 text-center text-sm font-medium text-muted-foreground">
                      {entry.longestStreak} days
                    </div>
                    <div className="w-28 text-right">
                      <div className="inline-flex items-center gap-1.5 font-display text-lg font-bold text-warn">
                        <Flame className="size-4" />
                        {entry.currentStreak}
                        <span className="text-xs font-normal text-muted-foreground">days</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Pagination page={page} totalPages={streakPages} total={filteredStreak.length} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  )
}

"use client"

import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { myQuestStatus, claimReward } from "@/actions/monetization"
import { getTier, xpForLevel } from "@/lib/tier"
import {
  Flame, Trophy, Sparkles, Check, Loader2, Zap,
  Target, Medal, ExternalLink,
} from "lucide-react"
import { toast } from "sonner"
import confetti from "canvas-confetti"
import { cssColor } from "@/lib/css-color"


export default function GamificationPage() {
  const queryClient = useQueryClient()
  const [claiming, setClaiming] = useState<string | null>(null)
  const [mobileSection, setMobileSection] = useState<"goals" | "achievements">("goals")

  // React Query handles caching, deduplication, and window-focus refresh
  const { data: s, isLoading } = useQuery({
    queryKey: ["quest-status"],
    queryFn: () => myQuestStatus(),
    // Refresh when user returns to the tab (they may have read/written outside)
    refetchOnWindowFocus: true,
    // Data is considered fresh for 60 s; no unnecessary background polls
    staleTime: 60_000,
  })

  const handleClaim = async (id: string, type: "quest" | "achievement") => {
    try {
      setClaiming(id)
      const res = await claimReward(id, type)
      if (res.success) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ["--success", "--info", "--note"].map(cssColor) })
        // Invalidate so React Query fetches fresh data immediately
        await queryClient.invalidateQueries({ queryKey: ["quest-status"] })
      } else {
        const msg: Record<string, string> = {
          expired: "This daily quest has expired.",
          already_claimed: "Already claimed.",
          not_earned: "You haven't completed this yet.",
        }
        toast.error(msg[res.reason as string] ?? "Couldn't claim this reward.")
        await queryClient.invalidateQueries({ queryKey: ["quest-status"] })
      }
    } catch (e) {
      console.error(e)
      toast.error("Couldn't claim this reward. Try again.")
    } finally {
      setClaiming(null)
    }
  }

  if (isLoading || !s)
    return (
      <div className="inline-flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    )

  const dailyQuests = s.quests.filter(q => q.quest_type === "daily")
  const lifetimeQuests = s.quests.filter(q => q.quest_type === "lifetime")

  const goalsPanel = (
    <div className="space-y-6">
      {dailyQuests.length > 0 && (
        <section>
          <SectionHeader
            icon={<Flame className="size-4 text-warn" />}
            title="Daily Quests"
            subtitle="Resets at midnight UTC"
          />
          <ul className="mt-3 space-y-2">
            {dailyQuests.map(q => (
              <QuestCard key={q.id} item={q} claiming={claiming} onClaim={handleClaim} />
            ))}
          </ul>
        </section>
      )}

      {lifetimeQuests.length > 0 && (
        <section>
          <SectionHeader
            icon={<Target className="size-4 text-primary" />}
            title="Active Goals"
            subtitle="Long-term milestones with XP + credit rewards"
          />
          <ul className="mt-3 space-y-2">
            {lifetimeQuests.map(q => (
              <QuestCard key={q.id} item={q} claiming={claiming} onClaim={handleClaim} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )

  const achievementsPanel = (
    <section>
      <SectionHeader
        icon={<Medal className="size-4 text-note" />}
        title="Achievements"
        subtitle="Tiered milestone badges · earn 2× XP"
      />
      {s.achievements.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No achievements unlocked yet. Keep writing and reading!</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {s.achievements.map(a => (
            <AchievementCard key={a.id} item={a} claiming={claiming} onClaim={handleClaim} />
          ))}
        </ul>
      )}
    </section>
  )

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6 md:p-8">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Quests &amp; Achievements</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Earn XP and rewards by writing, reading, and engaging.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full sm:w-auto">
          <div className="flex w-full sm:w-auto items-center gap-3 rounded-xl border border-warn/20 bg-warn/5 px-4 py-3">
            <Flame className="size-6 text-warn" />
            <div>
              <div className="text-xs font-medium text-warn/80 uppercase tracking-wider">Streak</div>
              <div className="font-display text-xl font-bold text-warn leading-none mt-1">
                {s.stats.current_streak} days
              </div>
            </div>
          </div>
          
          <div className="flex w-full sm:w-64 flex-col justify-center rounded-xl border border-border/50 bg-card px-4 py-3">
            {(() => {
              const tier = getTier(s.profile.level)
              const nextXp = tier.nextLevel ? xpForLevel(tier.nextLevel) : null
              const progressPct = nextXp ? Math.min(100, Math.round((s.profile.xp / nextXp) * 100)) : 100

              return (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{tier.emoji}</span>
                      <span className={`text-xs font-bold uppercase tracking-wider ${tier.color}`}>{tier.name}</span>
                    </div>
                    <div className="text-[10px] font-medium text-muted-foreground">
                      Lv {s.profile.level}
                    </div>
                  </div>
                  
                  {nextXp ? (
                    <div className="space-y-1.5">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className={`h-full transition-all duration-500 ${tier.bgColor.replace('/10', '')}`} style={{ width: `${progressPct}%`, backgroundColor: 'currentColor' }} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                        <span>{s.profile.xp.toLocaleString()} XP</span>
                        <span>{nextXp.toLocaleString()} XP</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs font-bold text-primary">MAX LEVEL</div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={<Flame className="size-4 text-warn" />} label="Best Streak" value={`${s.stats.longest_streak}d`} />
        <Stat icon={<Trophy className="size-4 text-note" />} label="Pieces Read" value={`${s.stats.pieces_read}`} />
        <Stat icon={<Zap className="size-4 text-info" />} label="Pieces Written" value={`${s.stats.pieces_written}`} />
        <Stat icon={<Sparkles className="size-4 text-success" />} label="Tips Received" value={`${s.stats.tips_received}`} />
      </div>

      {/* Leaderboard link */}
      <Link
        href="/studio/leaderboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <Trophy className="size-3.5" /> View Leaderboard
        <ExternalLink className="size-3" />
      </Link>

      {/* ── Mobile: section tab switcher ── */}
      <div className="flex sm:hidden gap-1 rounded-xl border border-border/50 bg-muted/40 p-1">
        <MobileTabBtn active={mobileSection === "goals"} onClick={() => setMobileSection("goals")}>
          <Target className="size-3.5" /> Goals
        </MobileTabBtn>
        <MobileTabBtn active={mobileSection === "achievements"} onClick={() => setMobileSection("achievements")}>
          <Medal className="size-3.5" /> Achievements
        </MobileTabBtn>
      </div>

      {/* ── Mobile: single panel ── */}
      <div className="sm:hidden">
        {mobileSection === "goals" ? goalsPanel : achievementsPanel}
      </div>

      {/* ── Desktop: 2-column grid ── */}
      <div className="hidden sm:grid gap-8 lg:grid-cols-2">
        <div>{goalsPanel}</div>
        <div>{achievementsPanel}</div>
      </div>

      <p className="text-xs text-muted-foreground">
        Progress refreshes when you switch back to this tab. Streaks tick automatically when you open Studio.
      </p>
    </div>
  )
}

function MobileTabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${
        active ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 font-display text-base font-semibold">
        {icon} {title}
      </div>
      <p className="text-[11px] text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="surface rounded-xl border border-border/50 p-4 shadow-sm">
      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
    </div>
  )
}

type RewardItem = {
  id: string
  title: string
  description: string
  reward_xp: number
  is_claimed: boolean
  current: number
  target_value: number
  can_claim: boolean
  tier?: string
}

function ProgressBar({ current, target, claimed }: { current: number; target: number; claimed: boolean }) {
  if (claimed) return null
  const pct = Math.min(Math.round((current / target) * 100), 100)
  const done = current >= target
  return (
    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full transition-all duration-500 ${done ? "bg-success" : "bg-primary"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function ClaimButton({ item, claiming, onClaim, type }: { item: RewardItem; claiming: string | null; onClaim: (id: string, type: "quest" | "achievement") => void; type: "quest" | "achievement" }) {
  if (item.is_claimed) {
    return (
      <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-success/10 px-2.5 text-xs font-medium text-success">
        <Check className="size-3.5" /> Claimed
      </span>
    )
  }
  if (item.can_claim) {
    return (
      <button
        onClick={() => onClaim(item.id, type)}
        disabled={claiming === item.id}
        className="inline-flex h-7 shrink-0 items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {claiming === item.id ? <Loader2 className="size-3.5 animate-spin" /> : "Claim"}
      </button>
    )
  }
  return (
    <span className="text-xs font-medium text-muted-foreground shrink-0">
      {item.current} / {item.target_value}
    </span>
  )
}

function QuestCard({ item, claiming, onClaim }: { item: RewardItem; claiming: string | null; onClaim: (id: string, type: "quest" | "achievement") => void }) {
  return (
    <li className={`surface overflow-hidden rounded-xl border p-4 shadow-sm transition-all ${item.is_claimed ? "border-success/20 bg-success/5 opacity-75" : "border-border/50 hover:border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-snug">{item.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{item.description}</p>
          <p className="mt-2 text-xs font-medium text-primary">+{item.reward_xp} XP</p>
        </div>
        <ClaimButton item={item} claiming={claiming} onClaim={onClaim} type="quest" />
      </div>
      <ProgressBar current={item.current} target={item.target_value} claimed={item.is_claimed} />
    </li>
  )
}

const TIER_STYLES: Record<string, string> = {
  diamond: "border border-primary/40 bg-primary/10 text-primary",
  platinum: "border border-info/40 bg-info/10 text-info",
  gold: "bg-note/10 text-note",
  silver: "border border-border bg-muted text-foreground/70",
  bronze: "bg-warn/10 text-warn",
}

function AchievementCard({ item, claiming, onClaim }: { item: RewardItem; claiming: string | null; onClaim: (id: string, type: "quest" | "achievement") => void }) {
  const tierStyle = item.tier ? (TIER_STYLES[item.tier] ?? "bg-muted text-muted-foreground") : ""
  return (
    <li className={`surface overflow-hidden rounded-xl border p-4 shadow-sm transition-all ${item.is_claimed ? "border-note/20 bg-note/5 opacity-75" : "border-border/50 hover:border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold leading-snug">{item.title}</h3>
            {item.tier && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${tierStyle}`}>
                {item.tier}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{item.description}</p>
          <p className="mt-2 text-xs font-medium text-note">+{item.reward_xp} XP</p>
        </div>
        <ClaimButton item={item} claiming={claiming} onClaim={onClaim} type="achievement" />
      </div>
      <ProgressBar current={item.current} target={item.target_value} claimed={item.is_claimed} />
    </li>
  )
}

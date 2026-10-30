import Link from "next/link"
import { AtSign, Hand, MessageCircle } from "lucide-react"
import { ACTIVITY_VERB } from "@/lib/activity-notifications"
import { Notif } from "@/lib/types/content"

// Mention / reply / response rows: links straight to the spot in the piece.
export function ActivityNotification({
  n,
  actorName,
  when,
  onClick,
  compact,
}: {
  n: Notif
  actorName?: string
  when: string
  onClick: () => void
  compact?: boolean
}) {
  const p = n.payload as { url?: string; title?: string; excerpt?: string; count?: number }
  const Icon = n.type === "mention" ? AtSign : n.type === "clap" ? Hand : MessageCircle
  const others = (p.count ?? 1) - 1
  const unread = !n.read_at
  return (
    <Link
      href={p.url ?? "/notifications"}
      onClick={onClick}
      className={`flex gap-3 transition-colors hover:bg-accent/40 ${compact ? "px-3 py-2.5" : "px-4 py-3"} ${unread ? "bg-primary/5" : ""}`}
    >
      <Icon className={`${compact ? "mt-0.5" : "mt-1"} size-4 shrink-0 text-primary`} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${compact ? "leading-snug" : ""}`}>
          <span className="font-medium">{actorName ?? "Someone"}</span>
          {others > 0 && <span className="text-muted-foreground"> and {others} {others === 1 ? "other" : "others"}</span>}{" "}
          <span className="text-muted-foreground">{ACTIVITY_VERB[n.type]}</span>{" "}
          <span>{p.title || "your piece"}</span>
        </p>
        {p.excerpt && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">“{p.excerpt}”</p>}
        <p className={`mt-0.5 text-muted-foreground ${compact ? "text-[11px]" : "text-xs"}`}>{when}</p>
      </div>
      {unread && <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />}
    </Link>
  )
}

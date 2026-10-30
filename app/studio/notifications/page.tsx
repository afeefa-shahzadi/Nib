"use client"

import { useCallback, useEffect, useState } from "react"
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/social"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Bell, Check, UserPlus, FileText, Loader2 } from "lucide-react"
import Link from "next/link"
import { ActivityNotification } from "@/components/activity-notification"
import { ACTIVITY_VERB } from "@/lib/activity-notifications"
import { toast } from "sonner"
import { Actor, Notif } from "@/lib/types/content"

function relTime(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function StudioNotificationsPage() {
  const listFn = listNotifications
  const markAllFn = markAllNotificationsRead
  const markOneFn = markNotificationRead

  const [notifs, setNotifs] = useState<Notif[]>([])
  const [actors, setActors] = useState<Record<string, Actor>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "unread">("all")

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const r = await listFn()
      setNotifs(r.notifications as Notif[])
      setActors(r.actors)
    } finally {
      setLoading(false)
    }
  }, [listFn])

  useEffect(() => {
    requestAnimationFrame(() => {
      refresh()
    })
  }, [refresh])

  useEffect(() => {
    const ch = supabase
      .channel("studio-notifications-page")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => refresh()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [refresh])

  const markAll = async () => {
    try {
      await markAllFn()
      setNotifs((ns) =>
        ns.map((n) => ({
          ...n,
          read_at: n.read_at ?? new Date().toISOString(),
        }))
      )
      toast.success("All marked as read")
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const markOne = async (id: string) => {
    try {
      await markOneFn({ data: { id } })
      setNotifs((ns) =>
        ns.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n
        )
      )
    } catch {
      /* noop */
    }
  }

  const visible =
    filter === "unread" ? notifs.filter((n) => !n.read_at) : notifs
  const unreadCount = notifs.filter((n) => !n.read_at).length

  return (
    <div className="mx-auto w-full max-w-350 p-6 md:p-8">
      <header className="mb-6">
        <p className="mb-2 inline-flex items-center gap-2 text-xs tracking-[0.2em] text-muted-foreground uppercase">
          <Bell className="size-3.5" /> Activity
        </p>
        <h1 className="font-display text-3xl tracking-tight">Notifications</h1>
      </header>

      <div className="mb-4 flex items-center justify-between">
        <div className="hairline inline-flex rounded-full p-1 text-xs">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1 ${filter === "all" ? "bg-accent text-foreground" : "text-muted-foreground"}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`rounded-full px-3 py-1 ${filter === "unread" ? "bg-accent text-foreground" : "text-muted-foreground"}`}
          >
            Unread{" "}
            {unreadCount > 0 && (
              <span className="ml-1 text-primary">({unreadCount})</span>
            )}
          </button>
        </div>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={markAll}
            className="gap-1.5"
          >
            <Check className="size-3.5" /> Mark all read
          </Button>
        )}
      </div>

      <div className="hairline divide-y divide-border overflow-hidden rounded-lg">
        {loading && (
          <div className="inline-flex w-full items-center justify-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        )}
        {!loading && visible.length === 0 && (
          <div className="px-4 py-16 text-center">
            <Bell className="mx-auto mb-3 size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {filter === "unread"
                ? "You're all caught up."
                : "No notifications yet."}
            </p>
          </div>
        )}
        {visible.map((n) => {
          const p = n.payload as {
            author_id?: string
            follower_id?: string
            piece_id?: string
            title?: string
            slug?: string
          }
          const isUnread = !n.read_at
          if (n.type === "new_piece") {
            const author = p.author_id ? actors[p.author_id] : undefined
            return (
              <Link
                key={n.id}
                href={`/u/${author?.handle ?? "_"}/${p.slug ?? ""}`}
                onClick={() => markOne(n.id)}
                className={`flex gap-3 px-4 py-3 transition-colors hover:bg-accent/40 ${isUnread ? "bg-primary/5" : ""}`}
              >
                <FileText className="mt-1 size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">
                      {author?.display_name ?? "Someone"}
                    </span>{" "}
                    <span className="text-muted-foreground">published</span>{" "}
                    <span>{p.title ?? "a new piece"}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {relTime(n.created_at)}
                  </p>
                </div>
                {isUnread && (
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                )}
              </Link>
            )
          }
          if (n.type === "new_follower") {
            const fol = p.follower_id ? actors[p.follower_id] : undefined
            return (
              <Link
                key={n.id}
                href={`/u/${fol?.handle ?? "_"}`}
                onClick={() => markOne(n.id)}
                className={`flex gap-3 px-4 py-3 transition-colors hover:bg-accent/40 ${isUnread ? "bg-primary/5" : ""}`}
              >
                <UserPlus className="mt-1 size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">
                      {fol?.display_name ?? "Someone"}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      started following you
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {relTime(n.created_at)}
                  </p>
                </div>
                {isUnread && (
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                )}
              </Link>
            )
          }
          if (n.type in ACTIVITY_VERB) {
            const p = n.payload as { sender_id?: string }
            return (
              <ActivityNotification
                key={n.id}
                n={n}
                actorName={p.sender_id ? actors[p.sender_id]?.display_name : undefined}
                when={relTime(n.created_at)}
                onClick={() => markOne(n.id)}
              />
            )
          }
          return null
        })}
      </div>
    </div>
  )
}

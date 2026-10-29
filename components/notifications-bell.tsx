"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bell, Check, UserPlus, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { supabase } from "@/lib/supabase/client"
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/social"
import { toast } from "sonner"
import { Actor, Notif } from "@/lib/types/content"

function relTime(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function NotificationsBell() {
  const listFn = listNotifications
  const markAllFn = markAllNotificationsRead
  const markOneFn = markNotificationRead

  const [signedIn, setSignedIn] = useState(false)
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [actors, setActors] = useState<Record<string, Actor>>({})
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) =>
      setSignedIn(!!s?.user)
    )
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setSignedIn(!!session?.user))
    return () => data.subscription.unsubscribe()
  }, [])

  const refresh = useCallback(async () => {
    if (!signedIn) return
    setLoading(true)
    try {
      const r = await listFn()
      setNotifs(r.notifications as Notif[])
      setActors(r.actors)
      setUnread(r.unread)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [signedIn, listFn])

  useEffect(() => {
    if (!signedIn) return
    const frame = requestAnimationFrame(() => {
      refresh()
    })
    const t = setInterval(refresh, 60_000)
    return () => {
      cancelAnimationFrame(frame)
      clearInterval(t)
    }
  }, [signedIn, refresh])

  // realtime: refresh on new notification
  useEffect(() => {
    if (!signedIn) return
    const ch = supabase
      .channel("notifications-bell")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => refresh()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [signedIn, refresh])

  if (!signedIn) return null

  const markAll = async () => {
    try {
      await markAllFn()
      setUnread(0)
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
      setUnread((u) => Math.max(0, u - 1))
    } catch {
      /* noop */
    }
  }

  const renderNotif = (n: Notif) => {
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
          onClick={() => {
            markOne(n.id)
            setOpen(false)
          }}
          className={`flex gap-3 px-3 py-2.5 transition-colors hover:bg-accent/40 ${isUnread ? "bg-primary/5" : ""}`}
        >
          <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug">
              <span className="font-medium">
                {author?.display_name ?? "Someone"}
              </span>{" "}
              <span className="text-muted-foreground">published</span>{" "}
              <span className="text-foreground">
                {p.title ?? "a new piece"}
              </span>
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
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
          onClick={() => {
            markOne(n.id)
            setOpen(false)
          }}
          className={`flex gap-3 px-3 py-2.5 transition-colors hover:bg-accent/40 ${isUnread ? "bg-primary/5" : ""}`}
        >
          <UserPlus className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug">
              <span className="font-medium">
                {fol?.display_name ?? "Someone"}
              </span>{" "}
              <span className="text-muted-foreground">
                started following you
              </span>
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {relTime(n.created_at)}
            </p>
          </div>
          {isUnread && (
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
          )}
        </Link>
      )
    }
    return null
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) refresh()
      }}
    >
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          className="relative"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 h-4 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-medium text-primary-foreground"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-90 p-0">
        <div className="hairline-b flex items-center justify-between px-3 py-2">
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Notifications
          </p>
          {unread > 0 && (
            <button
              onClick={markAll}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Check className="size-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-95 divide-y divide-border overflow-y-auto">
          {loading && notifs.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          )}
          {!loading && notifs.length === 0 && (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto mb-2 size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No notifications yet.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Follow authors to hear when they publish.
              </p>
            </div>
          )}
          {notifs.map(renderNotif)}
        </div>
      </PopoverContent>
    </Popover>
  )
}

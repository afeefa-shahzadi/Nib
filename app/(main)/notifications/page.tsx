"use client"
import { useCallback, useEffect, useState } from "react"
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/social"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Bell,
  Check,
  UserPlus,
  FileText,
  Loader2,
  IndianRupee,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { Actor, Notif } from "@/lib/types/content"

function relTime(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function NotificationsPage() {
  const listFn = listNotifications
  const markAllFn = markAllNotificationsRead
  const markOneFn = markNotificationRead

  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [actors, setActors] = useState<Record<string, Actor>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "unread">("all")

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setSignedIn(!!session?.user))
    const { data } = supabase.auth.onAuthStateChange((_e, s) =>
      setSignedIn(!!s?.user)
    )
    return () => data.subscription.unsubscribe()
  }, [])

  const refresh = useCallback(async () => {
    if (!signedIn) return
    setLoading(true)
    try {
      const r = await listFn()
      setNotifs(r.notifications as Notif[])
      setActors(r.actors)
    } finally {
      setLoading(false)
    }
  }, [signedIn, listFn])

  useEffect(() => {
    requestAnimationFrame(() => {
      refresh()
    })
  }, [refresh])

  useEffect(() => {
    if (!signedIn) return
    const ch = supabase
      .channel("notifications-page")
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
    <div className="flex min-h-screen flex-col bg-background">
      <main className="container-wide max-w-3xl flex-1 pt-16 pb-12 md:pt-24">
        <header className="mb-6">
          <p className="mb-2 inline-flex items-center gap-2 text-xs tracking-[0.2em] text-muted-foreground uppercase">
            <Bell className="size-3.5" /> Activity
          </p>
          <h1 className="font-display text-4xl tracking-tight">
            Notifications
          </h1>
        </header>

        {signedIn === false && (
          <div className="hairline rounded-lg p-10 text-center">
            <p className="mb-4 text-muted-foreground">
              Sign in to view your notifications.
            </p>
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        )}

        {signedIn && (
          <>
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
                  sender_id?: string
                  piece_id?: string
                  title?: string
                  slug?: string
                  amount_paise?: number
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
                          <span className="text-muted-foreground">
                            published
                          </span>{" "}
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
                if (n.type === "sale" || n.type === "curator_sale") {
                  const sender = p.sender_id ? actors[p.sender_id] : undefined
                  return (
                    <Link
                      key={n.id}
                      href="/studio/earnings"
                      onClick={() => markOne(n.id)}
                      className={`flex gap-3 px-4 py-3 transition-colors hover:bg-accent/40 ${isUnread ? "bg-primary/5" : ""}`}
                    >
                      <IndianRupee className="mt-1 size-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{sender?.display_name ?? "Someone"}</span>{" "}
                          <span className="text-muted-foreground">
                            {n.type === "curator_sale" ? "bought from your collection · you earned" : "bought your work"}
                          </span>{" "}
                          <span className="font-medium">
                            ₹{((p.amount_paise ?? 0) / 100).toLocaleString("en-IN")}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{relTime(n.created_at)}</p>
                      </div>
                      {isUnread && <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />}
                    </Link>
                  )
                }
                if (n.type === "tip_received") {
                  const sender = p.sender_id ? actors[p.sender_id] : undefined
                  return (
                    <Link
                      key={n.id}
                      href="/studio/earnings"
                      onClick={() => markOne(n.id)}
                      className={`flex gap-3 px-4 py-3 transition-colors hover:bg-accent/40 ${isUnread ? "bg-primary/5" : ""}`}
                    >
                      <IndianRupee className="mt-1 size-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-medium">
                            {sender?.display_name ?? "Someone"}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            tipped you
                          </span>{" "}
                          <span className="font-medium">
                            ₹{((p.amount_paise ?? 0) / 100).toLocaleString("en-IN")}
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
                return null
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

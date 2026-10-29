"use server"
import { createServiceRoleClient, createClient } from "@/lib/supabase/server"
import { getMyRole } from "@/actions/content/profile"
import { WAITLIST_ITEMS, type WaitlistItem } from "@/lib/waitlist"
import { checkRateLimit } from "@/lib/rate-limit.server"
import { headers } from "next/headers"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function joinWaitlist(args: {
  data: { item: WaitlistItem; email?: string; source?: string }
}): Promise<{ ok: true } | { error: string }> {
  const { item, email, source } = args.data
  if (!WAITLIST_ITEMS.includes(item)) return { error: "Unknown waitlist item" }

  const { data: auth } = await (await createClient()).auth.getUser()
  const user = auth?.user
  const raw = user?.email ?? email
  const addr = typeof raw === "string" ? raw.trim().toLowerCase() : ""
  if (addr.length > 254 || !EMAIL_RE.test(addr)) return { error: "Enter a valid email" }

  // Public, unauthenticated write: throttle per user, else per client IP (Vercel sets x-forwarded-for).
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  if (!(await checkRateLimit("waitlist", user?.id ?? ip, 10, 3600)).ok)
    return { error: "Too many requests. Try again later." }

  // RLS denies all client access to waitlist; write via service role.
  const db = await createServiceRoleClient()
  const { error } = await db.from("waitlist").upsert(
    { email: addr, user_id: user?.id ?? null, item, source: typeof source === "string" ? source.slice(0, 64) : null },
    { onConflict: "email,item", ignoreDuplicates: true }
  )
  return error ? { error: "Could not join the waitlist" } : { ok: true }
}

export async function listWaitlist(): Promise<
  { item: string; count: number; recent: { email: string; created_at: string }[] }[]
> {
  if ((await getMyRole()).primary !== "admin") return []
  const db = await createServiceRoleClient()
  const out = []
  for (const item of WAITLIST_ITEMS) {
    const [{ count, error: e1 }, { data, error: e2 }] = await Promise.all([
      db.from("waitlist").select("id", { count: "exact", head: true }).eq("item", item),
      db
        .from("waitlist")
        .select("email,created_at")
        .eq("item", item)
        .order("created_at", { ascending: false })
        .limit(10),
    ])
    if (e1 || e2) throw new Error("Could not load waitlist")
    if (count) out.push({ item, count, recent: (data ?? []) as { email: string; created_at: string }[] })
  }
  return out
}

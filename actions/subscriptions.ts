/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"
import { CurrencyCode } from "@/lib/currency"
import { getServerLocalAmount } from "@/lib/currency-server"
import { isLaunchFree, type Plan, assertPaymentsOpen } from "@/lib/plan"

const RZ_BASE = "https://api.razorpay.com/v1"

function rzAuth() {
  const id = process.env.RAZORPAY_KEY_ID
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!id || !secret) throw new Error("Razorpay not configured")
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64")
}

async function rz(path: string, init: RequestInit = {}) {
  const res = await fetch(`${RZ_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: rzAuth(),
      ...(init.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      (body as { error?: { description?: string } })?.error?.description ??
      `Razorpay ${res.status}`
    throw new Error(msg)
  }
  return body
}

async function ensurePlan(name: string, amountPaise: number, currency: CurrencyCode) {
  const localAmount = getServerLocalAmount(amountPaise, currency, true)
  
  // rz() already returns parsed JSON and throws on error; tolerate a plan-list
  // failure by treating it as "no existing plans" and creating a fresh one.
  let plans: { items?: any[] } = { items: [] }
  try {
    plans = (await rz("/plans?count=100")) as { items?: any[] }
  } catch (err) {
    console.error("[ensurePlan] plan list failed, creating new", err)
  }
  const existing = plans.items?.find(
    (p) => p.item.name === name && p.item.amount === localAmount && p.item.currency === currency
  )
  if (existing) return existing.id

  const plan = (await rz("/plans", {
    method: "POST",
    body: JSON.stringify({
      period: "monthly",
      interval: 1,
      item: { name, amount: localAmount, currency },
    }),
  })) as { id: string }
  return plan.id
}

// ============== Studio (per-author, ₹499/mo) ==============
const STUDIO_PRICE_PAISE = 49_900

export async function createStudioSubscription(args: { data?: any } = {}) {
  assertPaymentsOpen()
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { currency: CurrencyCode }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")
    const planId = await ensurePlan(
      "Nib Studio",
      STUDIO_PRICE_PAISE,
      data.currency || "INR"
    )

    const startAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60

    const sub = (await rz("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: planId,
        total_count: 12,
        customer_notify: 1,
        start_at: startAt,
        notes: { kind: "studio", userId: context.userId },
      }),
    })) as { id: string }

    const { error } = await supabaseAdmin.from("studio_subscriptions").insert({
      user_id: context.userId!,
      razorpay_subscription_id: sub.id,
      razorpay_plan_id: planId,
      status: "created",
    })
    if (error) {
      console.error("[studio sub]", error)
      throw new Error("Could not start subscription")
    }

    return { subscriptionId: sub.id, keyId: process.env.RAZORPAY_KEY_ID! }
  }
  try {
    return await __handler({ data: args?.data as any, context })
  } catch (err: unknown) {
    console.error("[studio sub]", err)
    return { error: err instanceof Error ? err.message : "Failed to create subscription" }
  }
}

export async function cancelStudioSubscription() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    const { data: sub } = await supabaseAdmin
      .from("studio_subscriptions")
      .select("razorpay_subscription_id")
      .eq("user_id", context.userId!)
      .in("status", ["active", "authenticated"])
      .maybeSingle()
    if (!sub) throw new Error("No active subscription")
    await rz(`/subscriptions/${sub.razorpay_subscription_id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ cancel_at_cycle_end: 1 }),
    })
    return { ok: true }
  }
  return await __handler({ context })
}

export async function cancelReaderSubscription() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    const { data: sub } = await supabaseAdmin
      .from("reader_subscriptions")
      .select("razorpay_subscription_id")
      .eq("user_id", context.userId!)
      .in("status", ["active", "authenticated"])
      .maybeSingle()
    if (!sub) throw new Error("No active subscription")
    await rz(`/subscriptions/${sub.razorpay_subscription_id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ cancel_at_cycle_end: 1 }),
    })
    return { ok: true }
  }
  return await __handler({ context })
}

// ============== Reader Pass (per-user, ₹199/mo) ==============
const READER_PRICE_PAISE = 19_900

export async function createReaderPassSubscription(args: { data?: any } = {}) {
  assertPaymentsOpen()
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { currency: CurrencyCode }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")
    const planId = await ensurePlan(
      "Nib Reader Pass",
      READER_PRICE_PAISE,
      data.currency || "INR"
    )

    // Reader pass doesn't have a 7-day trial in the same way, but let's just charge immediately
    const sub = (await rz("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: planId,
        total_count: 12,
        customer_notify: 1,
        notes: { kind: "reader", userId: context.userId },
      }),
    })) as { id: string }

    const { error } = await supabaseAdmin.from("reader_subscriptions").insert({
      user_id: context.userId!,
      razorpay_subscription_id: sub.id,
      razorpay_plan_id: planId,
      status: "created",
    })
    if (error) {
      console.error("[reader sub]", error)
      throw new Error("Could not start subscription")
    }

    return { subscriptionId: sub.id, keyId: process.env.RAZORPAY_KEY_ID! }
  }
  try {
    return await __handler({ data: args?.data as any, context })
  } catch (err: unknown) {
    console.error("[reader sub]", err)
    return { error: err instanceof Error ? err.message : "Failed to create subscription" }
  }
}

// ============== Organizations (per-seat, ₹399/seat/mo, min 3) ==============
const ORG_SEAT_PRICE_PAISE = 39_900

export async function createOrgSubscription(args: { data?: any } = {}) {
  assertPaymentsOpen()
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { org_id: string; seats: number; currency: CurrencyCode }
    context: ActionContext
  }) => {
    const { data: m } = await supabaseAdmin
      .from("org_members")
      .select("role")
      .eq("org_id", data.org_id)
      .eq("user_id", context.userId!)
      .maybeSingle()
    if (!m || !["owner", "admin"].includes(m.role)) {
      throw new Error("Only org owner/admin can manage billing")
    }

    const planId = await ensurePlan(
      "Nib Org Seat",
      ORG_SEAT_PRICE_PAISE,
      data.currency || "INR"
    )

    const sub = (await rz("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: planId,
        total_count: 12,
        quantity: data.seats,
        customer_notify: 1,
        notes: { kind: "org", orgId: data.org_id, seats: data.seats },
      }),
    })) as { id: string }

    const { error } = await supabaseAdmin.from("org_subscriptions").insert({
      org_id: data.org_id,
      razorpay_subscription_id: sub.id,
      razorpay_plan_id: planId,
      seats: data.seats,
      status: "created",
    })
    if (error) {
      console.error("[org sub]", error)
      throw new Error("Could not start subscription")
    }

    return {
      subscriptionId: sub.id,
      keyId: process.env.RAZORPAY_KEY_ID!,
      monthlyPaise: data.seats * ORG_SEAT_PRICE_PAISE,
    }
  }
  return await __handler({
    data: args?.data as { org_id: string; seats: number; currency: CurrencyCode },
    context,
  })
}

// ============== Plan lookup ==============
export async function getMyPlan() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    if (isLaunchFree())
      return { plan: "org" as Plan, subscription: null as any, launchFree: true }
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan, studio_credit_until")
      .eq("id", context.userId!)
      .maybeSingle()
    const { data: readerSub } = await supabaseAdmin
      .from("reader_subscriptions")
      .select("status, current_period_end")
      .eq("user_id", context.userId!)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    // Studio access is earnings-funded: it comes from studio_credit_until.
    // Honour live credit; lazily downgrade a stale 'studio' profile whose
    // credit has lapsed — this read-time check replaces a cron.
    const nowIso = new Date().toISOString()
    const creditUntil = profile?.studio_credit_until as string | null
    const hasCredit = !!creditUntil && creditUntil > nowIso
    let plan =
      (profile?.plan as "free" | "studio" | "org" | "reader") ?? "free"
    if (plan !== "org") {
      if (hasCredit) {
        plan = "studio"
      } else if (plan === "studio") {
        plan = "free"
        await supabaseAdmin
          .from("profiles")
          .update({ plan: "free" })
          .eq("id", context.userId!)
      }
    }

    return {
      plan: plan as Plan,
      subscription: (readerSub ??
        (hasCredit
          ? { status: "credit", current_period_end: creditUntil }
          : null)) as any,
      launchFree: false,
    }
  }
  return await __handler({ context })
}

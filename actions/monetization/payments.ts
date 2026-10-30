"use server"
import { assertPaymentsOpen } from "@/lib/plan"
import { createHmac, timingSafeEqual } from "crypto"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"
import { assertMonetizable } from "@/lib/nsfw"
import { assertNotRestricted } from "@/lib/restrictions"
import { alertOps } from "@/lib/alerts"
import { checkRateLimit } from "@/lib/rate-limit.server"
import { splitSale } from "@/lib/revenue-split"
import { SupabaseClient } from "@supabase/supabase-js"

const RZ_BASE = "https://api.razorpay.com/v1"
// ₹400 minimum so Razorpay payout fees don't eat small balances
const MIN_PAYOUT_PAISE = 40_000
// Chargeback hold: sale/tip earnings mature this long after landing before
// they become withdrawable, so a disputed payment is clawed back before the
// cash can leave. ponytail: flat 7d for all methods; tune if dispute data says so.
const HOLD_MS = 7 * 24 * 3600_000
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

export async function listActiveBoosts() {
  const supabaseAdmin = await createAdminClient()

  const __handler = async () => {
    const now = new Date().toISOString()
    const { data } = await supabaseAdmin
      .from("boosts")
      .select(
        `
        id, 
        content_object_id, 
        ends_at, 
        amount_paise,
        content_objects (
          title,
          slug,
          profiles (
            handle,
            display_name
          )
        )
      `
      )
      .eq("status", "active")
      .gt("ends_at", now)
      .order("amount_paise", { ascending: false })
      .limit(20)
    return data ?? []
  }
  return await __handler()
}

// ============== SPONSORSHIPS ==============
export async function togglePieceMonetization(args: { data?: unknown } = {}) {
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
    data: {
      contentObjectId: string
      tips_enabled?: boolean
      sponsorship_enabled?: boolean
    }
    context: ActionContext
  }) => {
    const { data: piece } = await supabaseAdmin
      .from("content_objects")
      .select("author_id")
      .eq("id", data.contentObjectId)
      .single()
    if (!piece || piece.author_id !== context.userId)
      throw new Error("Not your piece")
    const updates: Record<string, boolean> = {}
    if (data.tips_enabled !== undefined)
      updates.tips_enabled = data.tips_enabled
    if (data.sponsorship_enabled !== undefined)
      updates.sponsorship_enabled = data.sponsorship_enabled
    await supabaseAdmin
      .from("content_objects")
      .update(updates as never)
      .eq("id", data.contentObjectId)
    return { success: true }
  }
  return await __handler({
    data: args?.data as {
      contentObjectId: string
      tips_enabled?: boolean
      sponsorship_enabled?: boolean
    },
    context,
  })
}

export async function getActiveSponsorships(args: { data?: unknown } = {}) {
  const supabaseAdmin = await createAdminClient()

  const __handler = async ({ data }: { data: { contentObjectId: string } }) => {
    const now = new Date().toISOString()
    const { data: s } = await supabaseAdmin
      .from("sponsorships")
      .select(
        "id, sponsor_name, sponsor_url, sponsor_logo_url, disclosure_text, ends_at"
      )
      .eq("content_object_id", data.contentObjectId)
      .eq("status", "active")
      .or(`ends_at.is.null,ends_at.gt.${now}`)
    return s || []
  }
  return await __handler({
    data: args?.data as { contentObjectId: string },
  })
}

export async function addCreatorSponsorship(args: { data?: unknown } = {}) {
  const supabase = await createClient()
  const { data: _auth } = await supabase.auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabase,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: {
      contentObjectId: string
      sponsorName: string
      sponsorUrl?: string
      sponsorLogoUrl?: string
      disclosureText?: string
    }
    context: ActionContext
  }) => {
    // First, verify the user owns the content object
    const { data: piece, error: pieceError } = await context.supabase
      .from("content_objects")
      .select("author_id")
      .eq("id", data.contentObjectId)
      .single()

    if (pieceError || piece?.author_id !== context.userId) {
      throw new Error("Unauthorized to add sponsorship to this piece")
    }

    // Insert or update active sponsorship (if one already exists, we could just overwrite or create a new one. Let's just insert.)
    const { error } = await context.supabase.from("sponsorships").insert({
      content_object_id: data.contentObjectId,
      sponsor_name: data.sponsorName,
      sponsor_url: data.sponsorUrl || null,
      sponsor_logo_url: data.sponsorLogoUrl || null,
      disclosure_text: data.disclosureText || "Supported by",
      status: "active",
      amount_paise: 0, // Creator added manually, no amount tracked
    })

    if (error) {
      console.error("[server]", error)
      throw new Error("Failed to save sponsorship")
    }

    return { ok: true }
  }
  return await __handler({
    data: args?.data as {
      contentObjectId: string
      sponsorName: string
      sponsorUrl?: string
      sponsorLogoUrl?: string
      disclosureText?: string
    },
    context,
  })
}

export async function removeCreatorSponsorship(args: { data?: unknown } = {}) {
  const supabase = await createClient()
  const { data: _auth } = await supabase.auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabase,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { sponsorshipId: string; contentObjectId: string }
    context: ActionContext
  }) => {
    // Verify the user owns the content object
    const { data: piece, error: pieceError } = await context.supabase
      .from("content_objects")
      .select("author_id")
      .eq("id", data.contentObjectId)
      .single()

    if (pieceError || piece?.author_id !== context.userId) {
      throw new Error("Unauthorized to remove sponsorship from this piece")
    }

    const { error } = await context.supabase
      .from("sponsorships")
      .delete()
      .eq("id", data.sponsorshipId)
      .eq("content_object_id", data.contentObjectId) // extra safety

    if (error) {
      console.error("[server]", error)
      throw new Error("Failed to remove sponsorship")
    }

    return { ok: true }
  }
  return await __handler({
    data: args?.data as { sponsorshipId: string; contentObjectId: string },
    context,
  })
}

export async function createSponsorshipOrder(args: { data?: unknown } = {}) {
  assertPaymentsOpen()
  const supabase = await createClient()
  const { data: _auth } = await supabase.auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabase,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: {
      contentObjectId: string
      amountPaise: number
      sponsorName: string
      sponsorUrl?: string
      sponsorLogoUrl?: string
    }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Must be logged in to sponsor")
    if (data.amountPaise < 100000) throw new Error("Minimum sponsorship is ₹1,000")
    const supabaseAdmin = await createAdminClient()
    await assertMonetizable(supabaseAdmin, data.contentObjectId)

    // rz() already returns parsed JSON and throws on API error.
    const order = (await rz("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: data.amountPaise,
        currency: "INR",
        receipt: `spons_${data.contentObjectId.slice(0, 10)}`,
      }),
    })) as { id: string; amount: number; currency: string }

    const { error } = await supabaseAdmin.from("sponsorships").insert({
      content_object_id: data.contentObjectId,
      amount_paise: data.amountPaise,
      sponsor_name: data.sponsorName,
      sponsor_url: data.sponsorUrl || null,
      sponsor_logo_url: data.sponsorLogoUrl || null,
      disclosure_text: "Sponsored by",
      razorpay_order_id: order.id,
      status: "pending",
    })
    if (error) {
      console.error("[sponsorship]", error)
      throw new Error("Could not create sponsorship order")
    }

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID!,
    }
  }
  return await __handler({
    data: args?.data as {
      contentObjectId: string
      amountPaise: number
      sponsorName: string
      sponsorUrl?: string
      sponsorLogoUrl?: string
    },
    context,
  })
}

export async function verifySponsorshipPayment(args: { data?: unknown } = {}) {
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
  }: {
    data: {
      razorpay_order_id: string
      razorpay_payment_id: string
      razorpay_signature: string
    }
    context: ActionContext
  }) => {
    const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
      .digest("hex")
    const a = Buffer.from(expected)
    const b = Buffer.from(data.razorpay_signature)
    if (a.length !== b.length || !timingSafeEqual(a, b))
      throw new Error("Invalid signature")

    const { data: spons } = await supabaseAdmin
      .from("sponsorships")
      .select("*, piece:content_objects(author_id)")
      .eq("razorpay_order_id", data.razorpay_order_id)
      .single()
    if (!spons) throw new Error("Sponsorship not found")

    // Idempotency: a valid Razorpay signature is static and replayable. Only a
    // sponsorship still "pending" may be activated + credited; anything already
    // active/settled returns success without crediting again.
    if (spons.status !== "pending") {
      return { success: true, endsAt: spons.ends_at ?? null }
    }

    // Active for 7 days
    const ends = new Date(Date.now() + 7 * 24 * 3600_000)

    // Author share per lib/revenue-split.ts (85% of net on Free)
    const gross = spons.amount_paise
    const authorId = Array.isArray(spons.piece) ? spons.piece[0].author_id : spons.piece.author_id

    // Determine net via dynamic rules
    const net = await calculateAuthorNetPaise(authorId, gross, "sponsorship", supabaseAdmin)

    // Transaction
    const { error } = await supabaseAdmin.rpc("activate_sponsorship_tx", {
      p_sponsorship_id: spons.id,
      p_payment_id: data.razorpay_payment_id,
      p_ends_at: ends.toISOString(),
      p_author_id: authorId,
      p_gross: gross,
      p_net: net,
    })

    // If the RPC doesn't exist, do it sequentially. The update is gated on the
    // pending->active transition and only credits the ledger when THIS call
    // performed the transition, so concurrent/replayed calls can't double-credit.
    if (error && error.code === "42883") {
      const { data: activated } = await supabaseAdmin
        .from("sponsorships")
        .update({
          razorpay_payment_id: data.razorpay_payment_id,
          status: "active",
          ends_at: ends.toISOString(),
        })
        .eq("id", spons.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle()

      if (activated) {
        await supabaseAdmin.from("earnings_ledger").insert({
          user_id: authorId,
          source: "sponsorship",
          gross_paise: gross,
          net_paise: net,
          status: "available",
        })
      }
    } else if (error) {
      throw new Error("Activation failed")
    }

    return { success: true, endsAt: ends.toISOString() }
  }
  return await __handler({
    data: args?.data as {
      razorpay_order_id: string
      razorpay_payment_id: string
      razorpay_signature: string
    },
    context,
  })
}

// ============== EARNINGS + PAYOUTS ==============
export async function getMyEarnings() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    const { userId } = context
    const [{ data: ledger }, { data: payouts }, { data: pts }, balance] =
      await Promise.all([
        supabaseAdmin
          .from("earnings_ledger")
          .select("source, gross_paise, net_paise, status, created_at")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("payout_requests")
          .select("id, amount_paise, status, created_at")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("insight_points")
          .select("points")
          .eq("user_id", userId!),
        computeWithdrawableBalancePaise(supabaseAdmin, userId!),
      ])
    const paidOut = (payouts ?? [])
      .filter((p: { status: string }) => p.status === "paid")
      .reduce((s: number, r: { amount_paise: number }) => s + r.amount_paise, 0)
    return {
      lifetimeNet: balance.lifetimeNet,
      // Available already reserves pending/paid payouts — matches requestPayout.
      available: balance.availablePaise,
      // Earnings still inside the chargeback hold window (withdrawable soon).
      held: balance.heldPaise,
      paidOut,
      // Insight Points: a non-cashable reward score shown for motivation only.
      // Deliberately NOT part of `available`.
      points: (pts ?? []).reduce(
        (s: number, r: { points: number }) => s + r.points,
        0
      ),
      ledger: ledger ?? [],
      payouts: payouts ?? [],
    }
  }
  return await __handler({ context })
}

export async function requestPayout(args: { data?: unknown } = {}) {
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
    data: { amountPaise: number; destination?: string; payout_method_id?: string }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")
    const rl = await checkRateLimit("payout_request", context.userId, 20, 3600)
    if (!rl.ok) throw new Error("Too many payout attempts. Please wait.")
    // Reputation gate: a restricted creator can't withdraw while penalized.
    // restricted_until is service-role-only (a user client reads null and the
    // gate opens); supabaseAdmin is the service role.
    await assertNotRestricted(
      supabaseAdmin,
      context.userId!,
      "payout"
    )
    const { availablePaise, hasOpenRequest } =
      await computeWithdrawableBalancePaise(supabaseAdmin, context.userId!)
    if (!Number.isInteger(data.amountPaise) || data.amountPaise < MIN_PAYOUT_PAISE)
      throw new Error(`Minimum payout is ₹${MIN_PAYOUT_PAISE / 100}`)
    if (data.amountPaise > availablePaise)
      throw new Error(`Only ₹${(availablePaise / 100).toFixed(0)} available`)
    // Where to send the money. A structured payout method (bank/UPI) drives
    // automated RazorpayX disbursement; the free-text destination remains for
    // the manual/legacy path. The derived destination string is what the admin
    // and emails display either way.
    let destination =
      typeof data.destination === "string" ? data.destination.trim() : ""
    let payoutMethodId: string | null = null
    if (data.payout_method_id) {
      const svc = supabaseAdmin
      const { data: method } = await svc
        .from("payout_methods")
        .select("id, user_id, method_type, account_name, ifsc, vpa, pan")
        .eq("id", data.payout_method_id)
        .maybeSingle()
      if (!method || method.user_id !== context.userId)
        throw new Error("Payout method not found.")
      if (!method.pan)
        throw new Error("Add your PAN to this payout method before withdrawing.")
      payoutMethodId = method.id
      destination =
        method.method_type === "vpa"
          ? `UPI ${method.vpa}`
          : `${method.account_name} (${method.ifsc})`
    }
    if (!destination)
      throw new Error("Add a UPI ID or bank account to receive the payout.")
    // One open payout at a time. This app-level check is racy on its own; the
    // partial unique index (migration 20260717000000) is what actually prevents
    // two concurrent requests from both draining the same balance.
    if (hasOpenRequest)
      throw new Error("You already have a pending payout. Wait for it to settle.")
    const { error } = await supabaseAdmin.from("payout_requests").insert({
      user_id: context.userId!,
      amount_paise: data.amountPaise,
      destination,
      payout_method_id: payoutMethodId,
      status: "requested",
    })
    if (error) {
      if (error.code === "23505")
        throw new Error("You already have a pending payout. Wait for it to settle.")
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { success: true }
  }
  return await __handler({
    data: args?.data as {
      amountPaise: number
      destination?: string
      payout_method_id?: string
    },
    context,
  })
}

// Settle a one-time purchase (piece / bundle / tip) exactly once. Both the
// client confirm (verifyRazorpayPayment) and the Razorpay webhook call this;
// the gated created->paid transition guarantees only the first caller credits
// the creator's ledger and sends the notification. Returns true if it settled.
export async function settlePaidPurchase(
  supabaseAdmin: SupabaseClient,
  orderId: string,
  paymentId: string
): Promise<boolean> {
  const { data: paid } = await supabaseAdmin
    .from("purchases")
    .update({ razorpay_payment_id: paymentId, status: "paid" })
    .eq("razorpay_order_id", orderId)
    .eq("status", "created")
    .select("author_id, user_id, amount_paise, kind, curator_id, collection_id")
    .maybeSingle()
  if (!paid?.author_id) return false

  const feeType = paid.kind === "tip" ? "tip" : "purchase"
  // A curator is only stamped at order time after checking the collection,
  // the author's opt-in and that curator ≠ author (resolveCuratorAttribution).
  const curated = feeType === "purchase" && !!paid.curator_id
  const split = await calculateSaleSplit(
    paid.author_id,
    paid.amount_paise,
    feeType,
    curated,
    supabaseAdmin
  )
  const net = split.author
  // Stamp the credited shares on the purchase so a later refund/dispute can
  // reverse exactly what was credited (fee tiers are GMV-dependent and can't
  // be recomputed later) — see reversePaidPurchase.
  await supabaseAdmin
    .from("purchases")
    .update({ net_paise: net, curator_net_paise: curated ? split.curator : null })
    .eq("razorpay_order_id", orderId)
  await supabaseAdmin.from("earnings_ledger").insert({
    user_id: paid.author_id,
    source: paid.kind ?? "purchase",
    gross_paise: paid.amount_paise,
    net_paise: net,
    status: "available",
  })
  if (curated && split.curator > 0) {
    // gross 0: the curator's share must not count toward their own Studio cap.
    await supabaseAdmin.from("earnings_ledger").insert({
      user_id: paid.curator_id,
      source: "curator_share",
      gross_paise: 0,
      net_paise: split.curator,
      status: "available",
    })
    await supabaseAdmin.from("notifications").insert({
      user_id: paid.curator_id,
      type: "curator_sale",
      payload: {
        sender_id: paid.user_id,
        amount_paise: split.curator,
        collection_id: paid.collection_id,
      },
    })
  }
  await supabaseAdmin.from("notifications").insert({
    user_id: paid.author_id,
    type: paid.kind === "tip" ? "tip_received" : "sale",
    payload: {
      sender_id: paid.user_id,
      amount_paise: paid.amount_paise,
      kind: paid.kind ?? "purchase",
    },
  })
  // Lifetime tips_received counter (feeds the "Valued Creator" ladder). This
  // settlement path is gated to run exactly once per tip, so no double-count.
  if (paid.kind === "tip") {
    const { bumpUserStat } = await import("@/lib/quests.server")
    await bumpUserStat(paid.author_id, "tips_received")
  }
  return true
}

// Reverse a refunded/disputed purchase exactly once. The Razorpay webhook
// (refund.processed / payment.dispute.created) calls this; the gated
// paid->reversed transition makes replays no-ops. Writes a NEGATIVE
// earnings_ledger row for the net credited at settlement, so the balance
// self-corrects through computeWithdrawableBalancePaise. If the reversal
// leaves the creator negative the money already left — alert ops for manual
// recovery, never auto-recover. Returns true if this call reversed it.
export async function reversePaidPurchase(
  supabaseAdmin: SupabaseClient,
  orderId: string
): Promise<boolean> {
  const { data: reversed } = await supabaseAdmin
    .from("purchases")
    .update({ status: "reversed" })
    .eq("razorpay_order_id", orderId)
    .eq("status", "paid")
    .select("author_id, net_paise, amount_paise, curator_id, curator_net_paise")
    .maybeSingle()
  if (!reversed?.author_id) return false

  if (reversed.curator_id && reversed.curator_net_paise) {
    await supabaseAdmin.from("earnings_ledger").insert({
      user_id: reversed.curator_id,
      source: "chargeback",
      gross_paise: 0,
      net_paise: -reversed.curator_net_paise,
      status: "available",
    })
  }

  if (reversed.net_paise == null) {
    // Settled before purchases.net_paise existed — the exact credit is unknown.
    await alertOps(
      `[chargeback] order ${orderId} reversed but has no stored net — reverse the creator's ledger manually`,
      { orderId, authorId: reversed.author_id, amountPaise: reversed.amount_paise }
    )
    return false
  }

  await supabaseAdmin.from("earnings_ledger").insert({
    user_id: reversed.author_id,
    source: "chargeback",
    gross_paise: -reversed.net_paise,
    net_paise: -reversed.net_paise,
    status: "available",
  })

  const { availablePaise } = await computeWithdrawableBalancePaise(
    supabaseAdmin,
    reversed.author_id
  )
  if (availablePaise < 0) {
    await alertOps(
      `[chargeback] creator ${reversed.author_id} balance ₹${(availablePaise / 100).toFixed(2)} after reversing order ${orderId} — funds already withdrawn, manual recovery needed`,
      { orderId }
    )
  }
  return true
}

// SINGLE SOURCE OF TRUTH for a creator's withdrawable balance.
//
// INVARIANT: withdrawable money comes ONLY from creator sales — paid tips and
// the earnings_ledger. Insight Points (insight_points.points) and game credits
// (profiles.credits) are earned/granted, NOT cashable, and must NEVER be added
// here. Every payout and every "available balance" readout goes through this
// function so free currency can never leak into real money.
export async function computeWithdrawableBalancePaise(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<{
  lifetimeNet: number
  heldPaise: number
  reservedPaise: number
  availablePaise: number
  hasOpenRequest: boolean
}> {
  const [{ data: tipsIn }, { data: ledger }, { data: payouts }] =
    await Promise.all([
      supabaseAdmin
        .from("tips")
        .select("net_paise, created_at")
        .eq("author_id", userId)
        .eq("status", "paid"),
      supabaseAdmin
        .from("earnings_ledger")
        .select("net_paise, created_at")
        .eq("user_id", userId),
      supabaseAdmin
        .from("payout_requests")
        .select("amount_paise, status")
        .eq("user_id", userId),
    ])

  // Chargeback hold: positive earnings younger than HOLD_MS count toward
  // lifetime but not toward withdrawable — a dispute inside the window reverses
  // money that never left. Negative rows (studio_credit debit, chargeback
  // reversal) always apply IMMEDIATELY: if a fresh debit sat in the held bucket
  // it wouldn't reduce `available` for 7 days and could be double-spent.
  // Rows with no created_at are legacy — treat as matured.
  const cutoff = Date.now() - HOLD_MS
  let maturedNet = 0
  let heldPaise = 0
  for (const r of [...(tipsIn ?? []), ...(ledger ?? [])] as {
    net_paise?: number | null
    created_at?: string | null
  }[]) {
    const net = r.net_paise || 0
    if (net > 0 && r.created_at && new Date(r.created_at).getTime() > cutoff) {
      heldPaise += net
    } else {
      maturedNet += net
    }
  }
  const lifetimeNet = maturedNet + heldPaise
  // A payout reserves funds unless it failed (requested/processing/paid all hold).
  const reservedPaise = (payouts ?? [])
    .filter((p: { status: string }) => p.status !== "failed")
    .reduce(
      (s: number, r: { amount_paise?: number }) => s + (r.amount_paise || 0),
      0
    )
  const hasOpenRequest = (payouts ?? []).some(
    (p: { status: string }) =>
      p.status === "requested" || p.status === "processing"
  )
  return {
    lifetimeNet,
    heldPaise,
    reservedPaise,
    // Only matured money can leave — held earnings are still in the dispute window.
    availablePaise: maturedNet - reservedPaise,
    hasOpenRequest,
  }
}

export async function calculateAuthorNetPaise(
  authorId: string,
  grossPaise: number,
  type: "tip" | "sponsorship" | "purchase",
  supabaseAdmin: SupabaseClient
): Promise<number> {
  return (await calculateSaleSplit(authorId, grossPaise, type, false, supabaseAdmin)).author
}

// Author/curator/platform shares for one sale. Studio's ₹50k monthly cap counts
// the author's paid tips plus earnings-ledger gross since the 1st.
export async function calculateSaleSplit(
  authorId: string,
  grossPaise: number,
  type: "tip" | "sponsorship" | "purchase",
  curated: boolean,
  supabaseAdmin: SupabaseClient
) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan")
    .eq("id", authorId)
    .maybeSingle()
  const isStudio = profile?.plan === "studio"

  let studioMonthGmvPaise = 0
  if (isStudio) {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const startStr = startOfMonth.toISOString()
    const [{ data: tips }, { data: ledger }] = await Promise.all([
      supabaseAdmin
        .from("tips")
        .select("amount_paise")
        .eq("author_id", authorId)
        .eq("status", "paid")
        .gte("created_at", startStr),
      supabaseAdmin
        .from("earnings_ledger")
        .select("gross_paise")
        .eq("user_id", authorId)
        .gte("created_at", startStr),
    ])
    studioMonthGmvPaise =
      (tips ?? []).reduce((s: number, t: { amount_paise: number }) => s + t.amount_paise, 0) +
      (ledger ?? []).reduce((s: number, l: { gross_paise: number }) => s + l.gross_paise, 0)
  }

  return splitSale({ grossPaise, kind: type, isStudio, studioMonthGmvPaise, curated })
}

// ============== Apply earnings to Studio (pay ₹499 from balance) ==============
// Win-win alternative to withdrawing: the creator spends ₹499 of their
// withdrawable earnings on a month of Studio instead of a card charge. The
// money stays cash (a negative ledger row deducts it) — never converted to a
// non-cashable token. Access is time-boxed by profiles.studio_credit_until and
// honoured by getMyPlan, which lazily downgrades when it lapses (no cron).
const STUDIO_MONTH_PAISE = 49_900
export async function redeemStudioFromEarnings() {
  assertPaymentsOpen()
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    if (!context.userId) throw new Error("Unauthorized")
    const rl = await checkRateLimit("studio_redeem", context.userId, 10, 3600)
    if (!rl.ok) throw new Error("Too many attempts. Please wait.")

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan, studio_credit_until")
      .eq("id", context.userId)
      .maybeSingle()
    if (profile?.plan === "org") {
      throw new Error("Org members already have Studio access.")
    }

    // Fast pre-check for a clear message; the real guard is the recompute below.
    const { availablePaise } = await computeWithdrawableBalancePaise(
      supabaseAdmin,
      context.userId
    )
    if (availablePaise < STUDIO_MONTH_PAISE) {
      throw new Error(
        `You need ₹${STUDIO_MONTH_PAISE / 100} in available earnings to pay for a month of Studio.`
      )
    }

    // 1. Deduct ₹499 as a negative money row (stays cash, not IP). Insert first,
    // then recompute: the debit lowers `available` immediately, so a concurrent
    // redeem or payout (neither shares a lock with us) can't both drain the same
    // balance — whoever recomputes negative rolls back its own row.
    // ponytail: true concurrency where the user can afford one but not both may
    // roll back BOTH (fail-safe, retryable). DB-side atomic debit only if it matters.
    const { data: debit, error: debitErr } = await supabaseAdmin
      .from("earnings_ledger")
      .insert({
        user_id: context.userId,
        source: "studio_credit",
        gross_paise: -STUDIO_MONTH_PAISE,
        net_paise: -STUDIO_MONTH_PAISE,
        status: "available",
      })
      .select("id")
      .single()
    if (debitErr || !debit) {
      console.error("[studio-credit] debit failed", debitErr)
      throw new Error("Could not apply earnings. Please try again.")
    }
    const after = await computeWithdrawableBalancePaise(
      supabaseAdmin,
      context.userId
    )
    if (after.availablePaise < 0) {
      const { error: rbErr } = await supabaseAdmin
        .from("earnings_ledger")
        .delete()
        .eq("id", debit.id)
      if (rbErr)
        await alertOps("studio-credit debit stuck after failed rollback", {
          id: debit.id,
          err: rbErr,
        })
      throw new Error("Balance changed, please try again.")
    }

    // 2. Extend the credit window by 30 days, stacking on any unused credit.
    const now = new Date()
    const existing = profile?.studio_credit_until
      ? new Date(profile.studio_credit_until)
      : null
    const base = existing && existing > now ? existing : now
    const until = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000)

    await supabaseAdmin
      .from("profiles")
      .update({ studio_credit_until: until.toISOString(), plan: "studio" })
      .eq("id", context.userId)

    return { studioUntil: until.toISOString() }
  }
  return await __handler({ context })
}


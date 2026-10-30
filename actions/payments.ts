/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { assertPaymentsOpen } from "@/lib/plan"
import { createHmac, timingSafeEqual } from "crypto"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ActionContext } from "@/lib/types/actions"
import { assertMonetizable } from "@/lib/nsfw"
import { resolveCuratorAttribution } from "@/lib/curator-attribution"
import { checkRateLimit } from "@/lib/rate-limit.server"
import { rzFetch } from "@/lib/razorpay/api"

// ₹20 tip floor: below this the gateway's per-txn fee (~2% + GST, min ~₹2–3)
// can exceed the platform cut, so the payment clears at a loss. Piece/bundle
// prices are author-set and floored elsewhere; only free-amount tips need this.
const MIN_TIP_PAISE = 2_000

// ============== Create one-time order (bundle / piece / tip) ==============
export async function createRazorpayOrder(args: { data?: any } = {}) {
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
    data: {
      authorId?: string
      kind: "bundle" | "piece" | "tip"
      bundleId?: string
      contentObjectId?: string
      /** Collection the buyer came from; may earn its curator a share. */
      collectionId?: string
      amountPaise: number
    }
    context: ActionContext
  }) => {
    const { userId } = context
    if (!userId) throw new Error("Sign in to continue.")
    // Each order is a payment attempt; cap them per user to blunt card-testing
    // and order spam through this endpoint.
    const rl = await checkRateLimit("order_create", userId, 20, 600)
    if (!rl.ok)
      throw new Error("Too many payment attempts. Please wait a few minutes.")

    // The charged amount is authoritative server-side. Only a tip takes its
    // amount from the client; a bundle is priced from the DB. Never trust the
    // request body for a paid unlock — the old code did, letting a caller pay
    // ₹1 for a bundle and, via author-scoped access, unlock the whole catalog.
    let resolvedAuthorId = data.authorId
    let chargePaise: number
    if (data.kind === "bundle") {
      // Bundle checkout is parked (park/paid-features) until paid release.
      throw new Error("This item isn't available for purchase.")
    } else if (data.kind === "piece") {
      // Price and author come from the DB, never the request body. A piece
      // purchase unlocks that piece only (viewerHasAuthorAccess).
      if (!data.contentObjectId) throw new Error("contentObjectId required")
      const { data: piece } = await supabaseAdmin
        .from("content_objects")
        .select("author_id, price_paise, status")
        .eq("id", data.contentObjectId)
        .maybeSingle()
      if (!piece || piece.status !== "published" || !piece.price_paise)
        throw new Error("This item isn't available for purchase.")
      if (piece.author_id === userId) throw new Error("You can't buy your own piece.")
      await assertMonetizable(supabaseAdmin, data.contentObjectId)
      const { data: owned } = await supabaseAdmin
        .from("purchases")
        .select("id")
        .eq("user_id", userId)
        .eq("content_object_id", data.contentObjectId)
        .eq("kind", "piece")
        .eq("status", "paid")
        .limit(1)
      if (owned?.length) throw new Error("You already own this piece.")
      resolvedAuthorId = piece.author_id
      chargePaise = piece.price_paise
    } else {
      // tip: client-set amount, floored.
      if (!Number.isInteger(data.amountPaise) || data.amountPaise <= 0)
        throw new Error("Invalid amount")
      if (data.amountPaise < MIN_TIP_PAISE)
        throw new Error(`Minimum tip is ₹${MIN_TIP_PAISE / 100}`)
      if (!data.authorId) throw new Error("authorId required")
      // Block self-tipping: it's a net loss after fees, but it inflates the
      // creator's own GMV toward the reduced-fee cap — a self-wash. Not allowed.
      if (data.authorId === userId)
        throw new Error("You can't tip yourself.")
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", data.authorId)
        .single()
      if (!prof) throw new Error("Recipient not found")
      // Tip pinned to a specific piece: same NSFW rule applies.
      if (data.contentObjectId)
        await assertMonetizable(supabaseAdmin, data.contentObjectId)
      chargePaise = data.amountPaise
    }

    const order = (await rzFetch("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: chargePaise,
        currency: "INR",
        notes: { kind: data.kind, userId, authorId: resolvedAuthorId },
      }),
    })) as { id: string; amount: number; currency: string }

    const serviceClient = supabaseAdmin

    const item_id = data.contentObjectId ?? resolvedAuthorId!
    const referral =
      data.kind === "tip"
        ? null
        : await resolveCuratorAttribution(serviceClient, {
            collectionId: data.collectionId,
            contentObjectId: data.contentObjectId,
            bundleId: data.bundleId,
            authorId: resolvedAuthorId!,
            buyerId: userId,
          })

    const { error } = await serviceClient.from("purchases").insert({
      user_id: userId!,
      item_id,
      item_type: data.kind,
      author_id: resolvedAuthorId!,
      kind: data.kind,
      bundle_id: data.bundleId ?? null,
      content_object_id: data.contentObjectId ?? null,
      amount_paise: chargePaise,
      currency: "INR",
      razorpay_order_id: order.id,
      status: "created",
      collection_id: referral?.collectionId ?? null,
      curator_id: referral?.curatorId ?? null,
    })
    if (error) {
      console.error("[payments] insert purchase failed", error)
      throw new Error("Could not create order. Please try again.")
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
      authorId?: string
      kind: "bundle" | "piece" | "tip"
      bundleId?: string
      contentObjectId?: string
      /** Collection the buyer came from; may earn its curator a share. */
      collectionId?: string
      amountPaise: number
    },
    context,
  })
}

// ============== Verify checkout signature & mark paid ==============
export async function verifyRazorpayPayment(args: { data?: any } = {}) {
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
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("Invalid payment signature")
    }
    if (!context.userId) throw new Error("Unauthorized")

    // Settle via the shared helper so the ledger credit + notification happen
    // exactly once, regardless of whether this confirm or the webhook wins the
    // created->paid transition. Use a service-role client: purchases and
    // earnings_ledger have RLS with no INSERT/UPDATE policy, so the buyer-bound
    // client above can't flip the purchase or credit the author's ledger — it
    // would silently no-op, leaving settlement entirely dependent on the webhook.
    // The Razorpay signature is verified above, so elevated settlement is safe.
    const svc = supabaseAdmin
    const { settlePaidPurchase } = await import(
      "@/actions/monetization/payments"
    )
    // Split on Razorpay's actual fee (international cards cost more than the
    // domestic estimate). If the lookup fails, settlement falls back to it.
    const fee = await rzFetch(`/payments/${data.razorpay_payment_id}`)
      .then((p) => (p as { fee?: number | null }).fee ?? null)
      .catch(() => null)
    await settlePaidPurchase(
      svc,
      data.razorpay_order_id,
      data.razorpay_payment_id,
      fee
    )

    return { success: true }
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

// ============== Subscriptions: ensure plan, create subscription ==============
async function ensureTierPlan(tierId: string) {
  const supabaseAdmin = await createAdminClient()
  const { data: tier, error } = await supabaseAdmin
    .from("membership_tiers")
    .select("id, name, price_cents, razorpay_plan_id, author_id")
    .eq("id", tierId)
    .single()
  if (error || !tier) throw new Error("Tier not found")
  if (tier.price_cents <= 0)
    throw new Error("Tier is free; no subscription needed")
  if (tier.razorpay_plan_id) return tier

  const plan = (await rzFetch("/plans", {
    method: "POST",
    body: JSON.stringify({
      period: "monthly",
      interval: 1,
      item: {
        name: tier.name,
        amount: tier.price_cents,
        currency: "INR",
      },
    }),
  })) as { id: string }

  await supabaseAdmin
    .from("membership_tiers")
    .update({ razorpay_plan_id: plan.id })
    .eq("id", tier.id)
  return { ...tier, razorpay_plan_id: plan.id }
}

export async function createRazorpaySubscription(
  args: { data?: any } = {}
) {
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
    data: {
      tierId: string
    }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Sign in to continue.")
    const tier = await ensureTierPlan(data.tierId)
    if (tier.author_id === context.userId)
      throw new Error("You can't subscribe to your own plan.")
    const { data: active } = await supabaseAdmin
      .from("memberships")
      .select("id")
      .eq("user_id", context.userId)
      .eq("author_id", tier.author_id)
      .eq("status", "active")
      .limit(1)
    if (active?.length) throw new Error("You're already a member of this author.")

    const sub = (await rzFetch("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: tier.razorpay_plan_id,
        total_count: 12,
        customer_notify: 1,
        notes: {
          userId: context.userId!,
          tierId: tier.id,
          authorId: tier.author_id,
        },
      }),
    })) as { id: string }

    const serviceClient = supabaseAdmin

    const { error } = await serviceClient.from("payment_subscriptions").insert({
      user_id: context.userId!,
      author_id: tier.author_id,
      tier_id: tier.id,
      razorpay_subscription_id: sub.id,
      razorpay_plan_id: tier.razorpay_plan_id!,
      status: "created",
    })
    if (error) {
      console.error("[payments] insert subscription failed", error)
      throw new Error("Request failed. Please try again.")
    }

    return { subscriptionId: sub.id, keyId: process.env.RAZORPAY_KEY_ID! }
  }
  return await __handler({
    data: args?.data as { tierId: string },
    context,
  })
}

// ============== My access: list purchases + active subs ==============
export async function getMyAccess() {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    const [purchases, subs] = await Promise.all([
      supabaseAdmin
        .from("purchases")
        .select(
          "id, kind, bundle_id, content_object_id, author_id, amount_paise, status, created_at"
        )
        .eq("user_id", context.userId!)
        .eq("status", "paid"),
      supabaseAdmin
        .from("payment_subscriptions")
        .select("id, tier_id, author_id, status, current_period_end")
        .eq("user_id", context.userId!)
        .in("status", ["active", "authenticated"]),
    ])
    return {
      purchases: purchases.data ?? [],
      subscriptions: subs.data ?? [],
    }
  }
  return await __handler({
    context,
  })
}

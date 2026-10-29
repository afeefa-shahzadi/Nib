/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createServiceRoleClient, createClient } from "@/lib/supabase/server"
import { encryptSecret, decryptSecret } from "@/lib/crypto"
import { checkRateLimit } from "@/lib/rate-limit.server"
import {
  validatePayoutMethod,
  maskAccountNumber,
  maskPan,
  type PayoutMethodInput,
} from "@/lib/payouts/validate"

export type MaskedPayoutMethod = {
  id: string
  method_type: "bank_account" | "vpa"
  label: string
  account_last4: string | null
  pan_last4: string
  status: string
  is_default: boolean
}

async function currentUserId(): Promise<string | null> {
  const auth = await createClient()
  const { data } = await auth.auth.getUser()
  return data?.user?.id ?? null
}

export async function addPayoutMethod(args: { data: PayoutMethodInput }) {
  const userId = await currentUserId()
  if (!userId) return { success: false, error: "Unauthorized" }
  const rl = await checkRateLimit("payout_method_add", userId, 10, 3600)
  if (!rl.ok) return { success: false, error: "Too many attempts. Please wait." }

  const errors = validatePayoutMethod(args.data)
  if (Object.keys(errors).length)
    return { success: false, error: Object.values(errors)[0] }

  const svc = await createServiceRoleClient()
  const pan = args.data.pan.trim().toUpperCase()
  const row: Record<string, unknown> = {
    user_id: userId,
    method_type: args.data.method_type,
    pan: encryptSecret(pan),
    status: "unverified",
  }
  if (args.data.method_type === "bank_account") {
    row.account_name = args.data.account_name!.trim()
    row.account_number = encryptSecret(args.data.account_number!.trim())
    row.ifsc = args.data.ifsc!.trim().toUpperCase()
  } else {
    row.vpa = args.data.vpa!.trim()
  }
  const { error } = await svc.from("payout_methods").insert(row)
  if (error) {
    console.error("[server] addPayoutMethod:", error)
    return { success: false, error: "Could not save payout method." }
  }
  return { success: true }
}

export async function listMyPayoutMethods(): Promise<MaskedPayoutMethod[]> {
  const userId = await currentUserId()
  if (!userId) return []
  const svc = await createServiceRoleClient()
  const { data } = await svc
    .from("payout_methods")
    .select(
      "id, method_type, account_name, account_number, ifsc, vpa, pan, status, is_default"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  return (data ?? []).map((m: any) => {
    const acct = m.account_number ? decryptSecret(m.account_number) : null
    const label =
      m.method_type === "vpa"
        ? `UPI ${m.vpa}`
        : `${m.account_name} ${acct ? maskAccountNumber(acct) : ""}`.trim()
    return {
      id: m.id,
      method_type: m.method_type,
      label,
      account_last4: acct ? acct.slice(-4) : null,
      pan_last4: maskPan(decryptSecret(m.pan)).slice(-4),
      status: m.status,
      is_default: m.is_default,
    }
  })
}

export async function deletePayoutMethod(args: { data: { id: string } }) {
  const userId = await currentUserId()
  if (!userId) return { success: false, error: "Unauthorized" }
  const svc = await createServiceRoleClient()
  // Block deletion while an open payout references this method.
  const { data: open } = await svc
    .from("payout_requests")
    .select("id, status")
    .eq("payout_method_id", args.data.id)
    .in("status", ["requested", "processing"])
  if ((open ?? []).length)
    return { success: false, error: "A payout is in progress on this method." }
  await svc
    .from("payout_methods")
    .delete()
    .eq("id", args.data.id)
    .eq("user_id", userId)
  return { success: true }
}

export async function setDefaultPayoutMethod(args: { data: { id: string } }) {
  const userId = await currentUserId()
  if (!userId) return { success: false, error: "Unauthorized" }
  const svc = await createServiceRoleClient()
  await svc
    .from("payout_methods")
    .update({ is_default: false })
    .eq("user_id", userId)
  await svc
    .from("payout_methods")
    .update({ is_default: true })
    .eq("id", args.data.id)
    .eq("user_id", userId)
  return { success: true }
}

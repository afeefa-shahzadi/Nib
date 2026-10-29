"use server"

import { createServiceRoleClient, createClient } from "@/lib/supabase/server"
import { getRestriction } from "@/lib/restrictions"

// restriction_appeals and the restricted_* profile columns are service-role only
// (RLS no-policy / ungranted columns). Identity comes from the cookie session;
// the privileged reads/writes run on the service role.

export type MyRestriction = {
  restricted: boolean
  permanent: boolean
  until: string | null
  reason: string | null
  appealPending: boolean
}

export async function getMyRestriction(): Promise<MyRestriction> {
  const userClient = await createClient()
  const { data: auth } = await userClient.auth.getUser()
  const userId = auth?.user?.id
  if (!userId) throw new Error("Unauthorized")

  const svc = await createServiceRoleClient()
  const r = await getRestriction(svc, userId)
  let appealPending = false
  if (r.restricted) {
    const { data: a } = await svc
      .from("restriction_appeals")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .maybeSingle()
    appealPending = !!a
  }
  return {
    restricted: r.restricted,
    permanent: r.permanent,
    until: r.until ? r.until.toISOString() : null,
    reason: r.reason,
    appealPending,
  }
}

export async function submitAppeal(args: { data?: { reason?: string } } = {}) {
  const userClient = await createClient()
  const { data: auth } = await userClient.auth.getUser()
  const userId = auth?.user?.id
  if (!userId) throw new Error("Unauthorized")

  const reason = (args.data?.reason ?? "").trim()
  if (!reason) throw new Error("Add a short explanation for your appeal.")

  const svc = await createServiceRoleClient()
  const r = await getRestriction(svc, userId)
  if (!r.restricted) throw new Error("You have no active restriction to appeal.")

  // One open appeal per restriction. The partial unique index backstops this
  // against a race; the check gives a clean message on the common path.
  const { data: existing } = await svc
    .from("restriction_appeals")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle()
  if (existing) throw new Error("Your appeal is already under review.")

  const { error } = await svc
    .from("restriction_appeals")
    .insert({ user_id: userId, reason })
  if (error) {
    if (error.code === "23505")
      throw new Error("Your appeal is already under review.")
    console.error("[server] submitAppeal failed:", error)
    throw new Error("Request failed. Please try again.")
  }
  return { success: true }
}

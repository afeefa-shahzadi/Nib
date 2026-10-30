"use server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { HANDLE_RE } from "@/lib/handle"

// Live check for the settings handle field. Your own current handle counts as available.
export async function checkHandle(raw: string): Promise<{ ok: boolean; reason?: string }> {
  const handle = String(raw ?? "").trim().toLowerCase()
  if (!HANDLE_RE.test(handle)) return { ok: false, reason: "3–30 letters, numbers or _" }
  const { data: auth } = await (await createClient()).auth.getUser()
  const db = await createServiceRoleClient()
  const { data } = await db.from("profiles").select("id").eq("handle", handle).maybeSingle()
  if (data && data.id !== auth.user?.id) return { ok: false, reason: "Taken" }
  return { ok: true }
}

// "New pieces from writers I follow" is off when the reader's email is on the
// global suppression list (email_unsubscribes with author_id NULL) - the same list
// the per-email unsubscribe links write to, so both stay in sync.
async function me() {
  const { data: auth } = await (await createClient()).auth.getUser()
  const email = auth.user?.email?.toLowerCase()
  if (!email) throw new Error("Sign in first.")
  return { email, db: await createServiceRoleClient() }
}

export async function getEmailPrefs(): Promise<{ newPieces: boolean }> {
  const { email, db } = await me()
  const { data } = await db
    .from("email_unsubscribes")
    .select("email")
    .eq("email", email)
    .is("author_id", null)
    .maybeSingle()
  return { newPieces: !data }
}

export async function setEmailPrefs(prefs: { newPieces: boolean }) {
  const { email, db } = await me()
  if (prefs.newPieces) {
    await db.from("email_unsubscribes").delete().eq("email", email).is("author_id", null)
  } else {
    const { error } = await db.from("email_unsubscribes").insert({ email, author_id: null })
    if (error && error.code !== "23505") throw new Error("Couldn't save. Try again.")
  }
  return { ok: true }
}

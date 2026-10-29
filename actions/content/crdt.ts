"use server"

import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

// Durable Yjs doc snapshot for collaborative drafts. The table is service-role
// only; edit access is enforced here (the piece's author). A non-author peer can
// still edit live over the relay — their changes just persist via block autosave
// rather than the CRDT snapshot, which is safe (no data loss, no over-grant).
async function authorIdIfOwner(pieceId: string): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const svc = await createServiceRoleClient()
  const { data } = await svc
    .from("content_objects")
    .select("author_id")
    .eq("id", pieceId)
    .maybeSingle()
  return data && data.author_id === user.id ? user.id : null
}

// ~5 MB of base64 (~3.7 MB raw) cap — a sane ceiling for a single draft's doc.
const MAX_STATE = 5_000_000

export async function savePieceCrdt(args: {
  data: { pieceId: string; state: string }
}) {
  const { pieceId, state } = args.data
  if (typeof state !== "string" || state.length === 0 || state.length > MAX_STATE)
    return { ok: false }
  if (!(await authorIdIfOwner(pieceId))) return { ok: false }
  const svc = await createServiceRoleClient()
  const { error } = await svc
    .from("piece_crdt")
    .upsert({ piece_id: pieceId, state, updated_at: new Date().toISOString() })
  return { ok: !error }
}

export async function loadPieceCrdt(args: { data: { pieceId: string } }) {
  if (!(await authorIdIfOwner(args.data.pieceId))) return { state: null }
  const svc = await createServiceRoleClient()
  const { data } = await svc
    .from("piece_crdt")
    .select("state")
    .eq("piece_id", args.data.pieceId)
    .maybeSingle()
  return { state: data?.state ?? null }
}

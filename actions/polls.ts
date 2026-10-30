"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { getViewablePiece } from "@/actions/content/helpers"
import { checkRateLimit } from "@/lib/rate-limit.server"
import { tallyPoll } from "@/lib/poll"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The poll's options, if the block is a poll the viewer may read.
async function pollOptions(blockId: string, viewerId: string | null): Promise<string[] | null> {
  if (!UUID.test(blockId)) return null
  const db = await createAdminClient()
  const { data: b } = await db.from("blocks").select("content_object_id, type, content").eq("id", blockId).maybeSingle()
  const c = (b?.content ?? {}) as { exerciseType?: string; options?: { text?: string }[] }
  if (!b || b.type !== "exercise" || c.exerciseType !== "poll") return null
  if (!(await getViewablePiece(db, b.content_object_id, viewerId))) return null
  return (c.options ?? []).map((o) => (o.text ?? "").trim()).filter(Boolean)
}

async function results(blockId: string, options: string[]) {
  const db = await createAdminClient()
  // ponytail: tallies in JS; switch to a grouped count if a poll passes ~10k votes.
  const { data } = await db.from("poll_votes").select("choice").eq("block_id", blockId).limit(10000)
  return tallyPoll(options, (data ?? []).map((r: { choice: string }) => r.choice))
}

export async function getPollResults(blockId: string) {
  const { data } = await (await createClient()).auth.getUser()
  const options = await pollOptions(blockId, data.user?.id ?? null)
  return options ? results(blockId, options) : null
}

// One vote per reader per poll; voting again changes it. Guests vote with a
// random browser id so a refresh doesn't count twice.
export async function castPollVote(blockId: string, choice: string, anonId?: string) {
  const { data } = await (await createClient()).auth.getUser()
  const userId = data.user?.id ?? null
  if (!userId && !(anonId && UUID.test(anonId))) throw new Error("Couldn't record your vote.")
  const options = await pollOptions(blockId, userId)
  if (!options || !options.includes(choice.trim())) throw new Error("That option isn't in this poll.")
  const voter = userId ?? `anon:${anonId}`
  const rl = await checkRateLimit("poll_vote", voter, 30, 3600)
  if (!rl.ok) throw new Error("Too many votes for now. Try again later.")
  const db = await createAdminClient()
  await db.from("poll_votes").upsert({ block_id: blockId, voter, choice: choice.trim() }, { onConflict: "block_id,voter" })
  return results(blockId, options)
}

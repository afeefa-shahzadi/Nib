/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"

import { createAdminClient, createClient } from "@/lib/supabase/server"

export async function addRecommendation(_args: { data?: any } = {}) {
  const data = _args.data as { recommendedId: string; blurb?: string }
  const recommendedId = data.recommendedId
  const blurb = data.blurb

  const supabase = await createAdminClient()
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  if (!user) throw new Error("Unauthorized")

  if (user.id === recommendedId) {
    throw new Error("You cannot recommend yourself")
  }

  const { error } = await supabase.from("recommendations").insert({
    recommender_id: user.id,
    recommended_id: recommendedId,
    blurb: blurb || null,
  })

  if (error) {
    if (error.code === "23505")
      throw new Error("You already recommended this creator")
    throw new Error(error.message)
  }

  return { success: true }
}

export async function removeRecommendation(_args: { data?: any } = {}) {
  const data = _args.data as { recommendedId: string }
  const recommendedId = data.recommendedId

  const supabase = await createAdminClient()
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { error } = await supabase
    .from("recommendations")
    .delete()
    .match({ recommender_id: user.id, recommended_id: recommendedId })

  if (error) throw new Error(error.message)
  return { success: true }
}

export async function getMyRecommendations() {
  const supabase = await createAdminClient()
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { data } = await supabase
    .from("recommendations")
    .select(
      `
      id, blurb, created_at,
      profiles:recommended_id(id, display_name, handle, avatar_url, bio)
    `
    )
    .eq("recommender_id", user.id)
    .order("created_at", { ascending: false })

  return data || []
}

export async function getProfileRecommendations(handle: string) {
  const supabase = await createAdminClient()

  // Get user ID from handle
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("handle", handle)
    .single()

  if (!profile) return []

  const { data } = await supabase
    .from("recommendations")
    .select(
      `
      id, blurb, created_at,
      profiles:recommended_id(id, display_name, handle, avatar_url, bio)
    `
    )
    .eq("recommender_id", profile.id)
    .order("created_at", { ascending: false })

  return data || []
}

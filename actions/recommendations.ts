"use server"

import { createAdminClient, createClient } from "@/lib/supabase/server"

export async function submitRecommendationFeedback(pieceId: string, isLike: boolean) {
  const supabase = await createAdminClient()
  const { data: authData } = await (await createClient()).auth.getUser()

  if (!authData?.user?.id) {
    return { success: false, error: "Unauthorized" }
  }

  // Upsert feedback
  const { error } = await supabase
    .from("recommendation_feedback")
    .upsert(
      {
        piece_id: pieceId,
        user_id: authData.user.id,
        is_like: isLike,
      },
      { onConflict: "piece_id,user_id" }
    )

  if (error) {
    console.error("[server] Failed to submit recommendation feedback:", error)
    return { success: false, error: "Failed to submit feedback" }
  }

  return { success: true }
}

"use server"

import { createAdminClient, createClient } from "@/lib/supabase/server"

export async function createHighlight(pieceId: string, text: string) {
  const supabase = await createAdminClient()
  const { data: authData } = await (await createClient()).auth.getUser()

  if (!authData?.user?.id) {
    return { success: false, error: "Unauthorized" }
  }

  const { data, error } = await supabase
    .from("reader_highlights")
    .insert({
      piece_id: pieceId,
      user_id: authData.user.id,
      text_content: text,
    })
    .select()
    .single()

  if (error) {
    console.error("[server] Failed to create highlight:", error)
    return { success: false, error: "Failed to create highlight" }
  }

  return { success: true, highlightId: data.id }
}

export async function createAnnotation(highlightId: string, note: string) {
  const supabase = await createAdminClient()
  const { data: authData } = await (await createClient()).auth.getUser()

  if (!authData?.user?.id) {
    return { success: false, error: "Unauthorized" }
  }

  const { data: highlight } = await supabase
    .from("reader_highlights")
    .select("user_id")
    .eq("id", highlightId)
    .maybeSingle()
  if (!highlight || highlight.user_id !== authData.user.id) {
    return { success: false, error: "Not authorized" }
  }

  const { error } = await supabase
    .from("reader_annotations")
    .insert({
      highlight_id: highlightId,
      user_id: authData.user.id,
      note,
    })

  if (error) {
    console.error("[server] Failed to create annotation:", error)
    return { success: false, error: "Failed to create annotation" }
  }

  return { success: true }
}

export async function getMyHighlights(pieceId: string) {
  const supabase = await createAdminClient()
  const { data: authData } = await (await createClient()).auth.getUser()

  if (!authData?.user?.id) return []

  const { data } = await supabase
    .from("reader_highlights")
    .select("*, annotations:reader_annotations(*)")
    .eq("piece_id", pieceId)
    .eq("user_id", authData.user.id)

  return data || []
}

export async function getAllMyHighlights() {
  const supabase = await createAdminClient()
  const { data: authData } = await (await createClient()).auth.getUser()

  if (!authData?.user?.id) return []

  const { data } = await supabase
    .from("reader_highlights")
    .select(`
      *, 
      annotations:reader_annotations(*),
      piece:content_objects(title, slug, author:profiles(handle, display_name))
    `)
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  return data || []
}

export async function deleteHighlight(highlightId: string) {
  const supabase = await createAdminClient()
  const { data: authData } = await (await createClient()).auth.getUser()

  if (!authData?.user?.id) {
    return { success: false, error: "Unauthorized" }
  }

  const { error } = await supabase
    .from("reader_highlights")
    .delete()
    .eq("id", highlightId)
    .eq("user_id", authData.user.id)

  if (error) {
    console.error("[server] Failed to delete highlight:", error)
    return { success: false, error: "Failed to delete highlight" }
  }

  return { success: true }
}

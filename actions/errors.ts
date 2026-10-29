"use server"

import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

interface ErrorLogPayload {
  message: string
  stack?: string
  url?: string
  userAgent?: string
}

export async function logError(payload: ErrorLogPayload) {
  try {
    const supabase = await createClient()

    // Get user session if authenticated
    let userId: string | null = null
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      userId = user?.id || null
    } catch {
      // Ignore auth check error (e.g. if auth API is down or not authenticated)
    }

    // Truncate fields to protect DB against storage abuse
    const message = (payload.message || "").substring(0, 1000)
    const stack = payload.stack ? payload.stack.substring(0, 4000) : null
    const url = payload.url ? payload.url.substring(0, 1000) : null
    const userAgent = payload.userAgent
      ? payload.userAgent.substring(0, 500)
      : null

    // Write securely using admin client bypasses public RLS insert rules
    const adminSupabase = await createServiceRoleClient()
    const { error } = await adminSupabase.from("error_logs").insert({
      message,
      stack,
      url,
      user_agent: userAgent,
      user_id: userId,
    })

    if (error) {
      console.error("Failed to insert error log to Supabase:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error("Error inside logError action:", err)
    return { success: false, error: String(err) }
  }
}

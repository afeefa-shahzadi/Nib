"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import type { Session, User } from "@supabase/supabase-js"

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  })

  useEffect(() => {
    // Subscribe first to avoid missing events
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, user: session?.user ?? null, loading: false })
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ session, user: session?.user ?? null, loading: false })
    })

    return () => data.subscription.unsubscribe()
  }, [])

  return state
}

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { cache } from "react"

// One client per request (React cache), and getUser() deduped per access
// token: a signed-in page render fans out to many actions that each verify
// the user, and every unmemoized call is a round trip to Supabase Auth.
// Keyed by token, so a sign-in/refresh mid-request still verifies afresh.
export const createClient = cache(async () => {
  const client = await createUncachedClient()
  const getUser = client.auth.getUser.bind(client.auth)
  const seen = new Map<string, ReturnType<typeof getUser>>()
  client.auth.getUser = async (jwt?: string) => {
    if (jwt) return getUser(jwt)
    const token = (await client.auth.getSession()).data.session?.access_token
    if (!token) return getUser()
    if (!seen.has(token)) seen.set(token, getUser(token))
    return seen.get(token)!
  }
  return client
})

async function createUncachedClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Service role, no cookies: bypasses RLS. Read identity with createClient(),
// and scope every write by that verified user id in code.
export async function createAdminClient() {
  return createServiceRoleClient()
}

export async function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

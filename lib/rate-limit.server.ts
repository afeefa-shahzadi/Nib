// Simple fixed-window rate limiter backed by the public.rate_limits table.
// Use only from server routes / server functions. Service-role only.
// rate_limits is RLS-on/no-policy, so it needs the service-role client: as
// `authenticated` reads fail and the limiter fails open.
import { createServiceRoleClient } from "@/lib/supabase/server"

// ok = the count before this hit was under the limit, so increment 0 is a
// pure check ("is there budget left?") and token-sized increments still
// record usage. Every hit counts, blocked ones included.
export async function checkRateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
  increment: number = 1
): Promise<{ ok: boolean; remaining: number; resetAt: Date }> {
  const { data, error } = await (await createServiceRoleClient())
    .rpc("rate_limit_hit", {
      p_bucket: bucket,
      p_identifier: identifier,
      p_window_seconds: windowSeconds,
      p_increment: increment,
    })
    .single<{ count: number; window_start: string }>()
  // Fail open (as before) if the DB is unreachable or the migration isn't applied yet.
  if (error || !data) {
    console.error("[rate-limit]", error)
    return { ok: true, remaining: limit, resetAt: new Date(Date.now() + windowSeconds * 1000) }
  }
  const before = data.count - increment
  return {
    ok: before < limit,
    remaining: Math.max(0, limit - data.count),
    resetAt: new Date(new Date(data.window_start).getTime() + windowSeconds * 1000),
  }
}

export function rateLimitResponse(resetAt: Date): Response {
  return new Response(
    JSON.stringify({ error: "rate_limited", resetAt: resetAt.toISOString() }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(
          Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))
        ),
      },
    }
  )
}

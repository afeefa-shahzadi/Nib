// Simple fixed-window rate limiter backed by the public.rate_limits table.
// Use only from server routes / server functions. Service-role only.
// rate_limits is RLS-on/no-policy, so it needs the service-role client: as
// `authenticated` reads fail and the limiter fails open.
import { createServiceRoleClient } from "@/lib/supabase/server"

export async function checkRateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
  increment: number = 1
): Promise<{ ok: boolean; remaining: number; resetAt: Date }> {
  const now = new Date()
  const { data: existing } = await (await createServiceRoleClient())
    .from("rate_limits")
    .select("count, window_start")
    .eq("bucket", bucket)
    .eq("identifier", identifier)
    .maybeSingle()

  const windowMs = windowSeconds * 1000
  if (
    !existing ||
    now.getTime() - new Date(existing.window_start).getTime() > windowMs
  ) {
    await (await createServiceRoleClient())
      .from("rate_limits")
      .upsert({
        bucket,
        identifier,
        count: increment,
        window_start: now.toISOString(),
      })
    return {
      ok: true,
      remaining: limit - increment,
      resetAt: new Date(now.getTime() + windowMs),
    }
  }
  if (existing.count >= limit && increment > 0) {
    return {
      ok: false,
      remaining: 0,
      resetAt: new Date(new Date(existing.window_start).getTime() + windowMs),
    }
  }
  await (
    await createServiceRoleClient()
  )
    .from("rate_limits")
    .update({ count: existing.count + increment })
    .eq("bucket", bucket)
    .eq("identifier", identifier)
  return {
    ok: true,
    remaining: limit - existing.count - increment,
    resetAt: new Date(new Date(existing.window_start).getTime() + windowMs),
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

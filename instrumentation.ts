export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (process.env.NODE_ENV !== "production") return
  try {
    const { checkEnv } = await import("@/lib/env-check")
    for (const line of checkEnv()) console.warn("[env] " + line)
  } catch (e) {
    console.error("[env] check failed", e)
  }
}

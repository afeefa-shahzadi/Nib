// Ops alert sink: POST to ALERT_WEBHOOK_URL (Slack incoming-webhook compatible)
// when set; always console.error so Vercel logs keep the record. Never throws —
// an alert failure must not break a money path.
export async function alertOps(
  message: string,
  context?: Record<string, unknown>
) {
  console.error("[alert]", message, context ?? "")
  const url = process.env.ALERT_WEBHOOK_URL
  if (!url) return
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message, context }),
    })
  } catch (err) {
    console.error("[alert] webhook delivery failed", err)
  }
}

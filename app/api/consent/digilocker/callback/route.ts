import { NextResponse, type NextRequest } from "next/server"
import { digilockerDob, digilockerEnabled, isAdultOn } from "@/lib/consent-methods"
import { grantConsent } from "@/lib/parental-consent"

// DigiLocker returns here; approve only if the holder is 18 or older.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  let u = "", t = ""
  try {
    ;({ u, t } = JSON.parse(Buffer.from(p.get("state") ?? "", "base64url").toString()))
  } catch {}
  const back = (msg?: string) =>
    NextResponse.redirect(
      new URL(`/parental-consent?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}${msg ? `&error=${msg}` : ""}`, req.url)
    )
  const code = p.get("code")
  if (!digilockerEnabled() || !code || !u || !t) return back("digilocker")
  try {
    const { dob, reference } = await digilockerDob(code)
    if (!isAdultOn(dob)) return back("not_adult")
    await grantConsent(u, t, {
      method: "digilocker",
      declaredAdult: true,
      reference,
      ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
      userAgent: req.headers.get("user-agent"),
    })
    return back()
  } catch (e) {
    console.error("[consent] digilocker", e)
    return back("digilocker")
  }
}

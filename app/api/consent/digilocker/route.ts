import { NextResponse, type NextRequest } from "next/server"
import { digilockerAuthorizeUrl, digilockerEnabled } from "@/lib/consent-methods"
import { verifyConsentLink } from "@/lib/parental-consent"

// Starts the DigiLocker age check for a parent (dormant during launch).
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? ""
  const t = req.nextUrl.searchParams.get("t") ?? ""
  if (!digilockerEnabled() || !(await verifyConsentLink(u, t)))
    return NextResponse.redirect(new URL(`/parental-consent?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}`, req.url))
  // The consent token travels in state and is re-verified on the way back.
  const state = Buffer.from(JSON.stringify({ u, t })).toString("base64url")
  return NextResponse.redirect(digilockerAuthorizeUrl(state))
}

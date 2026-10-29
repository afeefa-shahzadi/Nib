import { NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"
import { lookup } from "dns/promises"
import { createClient } from "@/lib/supabase/server"
import { isPrivateAddress } from "@/lib/ssrf"

export async function GET(request: NextRequest) {
  // Require a session — this endpoint makes arbitrary outbound requests on the
  // server's behalf, so it must not be reachable anonymously.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const url = searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
  }

  let target: URL
  try {
    target = new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "Unsupported scheme" }, { status: 400 })
  }

  try {
    // Resolve the host and reject if it maps to any internal address. Note this
    // does not fully close a DNS-rebind race, but it blocks the direct
    // metadata/RFC1918 SSRF vectors this endpoint is exposed to.
    const resolved = await lookup(target.hostname, { all: true })
    if (resolved.length === 0 || resolved.some((r) => isPrivateAddress(r.address))) {
      return NextResponse.json({ error: "Blocked host" }, { status: 400 })
    }

    const response = await fetch(target, {
      redirect: "error", // don't follow a redirect into an internal host
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch URL", status: response.status })
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $("title").text() ||
      ""

    const description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="twitter:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      ""

    const image =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      ""

    const favicon =
      $('link[rel="apple-touch-icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href") ||
      $('link[rel="icon"]').attr("href") ||
      "/favicon.ico"

    let resolvedImage = ""
    if (image) {
      try { resolvedImage = new URL(image, url).href } catch {}
    }
    let resolvedFavicon = ""
    if (favicon) {
      try { resolvedFavicon = new URL(favicon, url).href } catch {}
    }

    return NextResponse.json({
      title: title.trim(),
      description: description.trim(),
      image: resolvedImage.trim(),
      logo: resolvedFavicon.trim(),
      url,
    })
  } catch (error) {
    console.error("Link preview error:", error)
    return NextResponse.json({ error: "Failed to parse URL" }, { status: 500 })
  }
}

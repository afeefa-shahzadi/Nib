import type { SupabaseClient } from "@supabase/supabase-js"
import type { ImportedBlock } from "./html-to-blocks"
import { isPrivateHost, safeFetch } from "./ssrf"

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB per image
const MAX_IMAGES = 60 // per piece
const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "image/gif": "gif", "image/avif": "avif", "image/svg+xml": "svg",
}

// Download each imported image from its source CDN and re-upload to our storage,
// rewriting the block's imageUrl — so imported pieces don't hotlink a URL that
// can rot (hotlink protection, expiry, source deletion). Best-effort: on any
// failure the original URL is kept, so a failed rehost still shows the image.
// ponytail: sequential + per-piece cap; fine for an import, not a bulk job.
export async function rehostImages(
  blocks: ImportedBlock[],
  userId: string,
  svc: SupabaseClient
): Promise<{ rehosted: number }> {
  let rehosted = 0
  for (const b of blocks) {
    if (rehosted >= MAX_IMAGES) break
    if (b.type !== "image") continue
    const url = b.content.imageUrl
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) continue
    try {
      const u = new URL(url)
      if (isPrivateHost(u.hostname)) continue
      const res = await safeFetch(url, { headers: { "user-agent": "NibImporter/1.0" } })
      if (!res.ok) continue
      const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase()
      if (!type.startsWith("image/")) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) continue
      const ext = EXT[type] || "jpg"
      const path = `${userId}/imported/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error } = await svc.storage
        .from("post-media")
        .upload(path, buf, { contentType: type, upsert: false })
      if (error) continue
      const { data: pub } = svc.storage.from("post-media").getPublicUrl(path)
      b.content.imageUrl = pub.publicUrl
      rehosted++
    } catch {
      // keep original URL (hotlink fallback)
    }
  }
  return { rehosted }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { hasStudioAccess } from "@/lib/plan"
import JSZip from "jszip"
import { blocksToMarkdown } from "@/lib/export/markdown"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  try {
    const profileId = user.id

    // Fetch the profile with the service role: sensitive columns (BYOK key,
    // DOB, disability flags, Stripe id) are revoked from the user-facing role
    // — and so is the table-level SELECT that `*` needs — while exporting
    // one's own data legitimately includes them. Scoped to the verified id.
    const admin = await createServiceRoleClient()
    const { data: profile } = await admin
      .from("profiles")
      .select("*")
      .eq("id", profileId)
      .single()

    const hasStudio = hasStudioAccess(profile?.plan)
    if (!hasStudio) {
      return new NextResponse("Forbidden. Studio or Organizations plan required.", { status: 403 })
    }

    // Fetch Content Objects
    const { data: contentObjects } = await supabase
      .from("content_objects")
      .select("*")
      .eq("author_id", profileId)

    // Fetch Blocks for those objects
    const objectIds = contentObjects?.map((o: { id: string }) => o.id) || []

    let blocks: Record<string, unknown>[] = []
    if (objectIds.length > 0) {
      const { data: blocksData } = await supabase
        .from("blocks")
        .select("*")
        .in("content_object_id", objectIds)
      blocks = blocksData || []
    }

    // Fetch Branches
    let branches: Record<string, unknown>[] = []
    if (objectIds.length > 0) {
      const { data: branchesData } = await supabase
        .from("branches")
        .select("*")
        .in("parent_object_id", objectIds)
      branches = branchesData || []
    }

    const zip = new JSZip()

    // Build Export Object JSON
    const exportData = {
      version: "1.0",
      exported_at: new Date().toISOString(),
      profile,
      content_objects: contentObjects,
      blocks,
      branches,
    }

    zip.file("data.json", JSON.stringify(exportData, null, 2))

    // Build Markdown files
    const mdFolder = zip.folder("markdown")
    if (mdFolder && contentObjects) {
      for (const piece of contentObjects) {
        const pieceBlocks = blocks.filter(
          (b) => b.content_object_id === piece.id
        ) as Parameters<typeof blocksToMarkdown>[1]
        const mdContent = blocksToMarkdown(piece.title, pieceBlocks)
        const filename = `${piece.slug || piece.id}.md`
        mdFolder.file(filename, mdContent)
      }
    }

    const zipBuffer = await zip.generateAsync({ type: "uint8array" })

    return new NextResponse(zipBuffer as any as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="nib_export_${profile?.handle || "user"}.zip"`,
      },
    })
  } catch (error) {
    console.error("[export API] Failed to generate export", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

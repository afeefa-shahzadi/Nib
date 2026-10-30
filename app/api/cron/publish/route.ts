/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { sendPublishEmail } from "@/lib/email"

// Route needs to be dynamic to run queries
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  // Fail closed: an unset CRON_SECRET must not leave this route public.
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 })
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabaseAdmin = await createAdminClient()

  try {
    // 1. Find all pieces that are scheduled and ready to be published
    // i.e., status = 'scheduled' AND scheduled_for <= NOW()
    const { data: readyPieces, error: fetchError } = await supabaseAdmin
      .from("content_objects")
      .select(
        "id, title, summary, slug, author_id, author:profiles!content_objects_author_id_profiles_id_fk(display_name, handle)"
      )
      .eq("status", "scheduled")
      .lte("scheduled_for", new Date().toISOString())

    if (fetchError) {
      console.error(
        "[Cron Publish] Error fetching scheduled pieces:",
        fetchError
      )
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    if (!readyPieces || readyPieces.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: "No pieces scheduled for publication at this time.",
      })
    }

    const publishedIds: string[] = []
    const revertedIds: string[] = []

    // Authors restricted (temp freeze or permanent ban) at publish time: their
    // scheduled pieces revert to draft rather than auto-publishing. Batched to one
    // query rather than a per-piece restriction lookup.
    const authorIds = [...new Set(readyPieces.map((p) => p.author_id))]
    const restrictedAuthors = new Set<string>()
    if (authorIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, restricted_until")
        .in("id", authorIds)
      const now = Date.now()
      for (const p of profs ?? []) {
        const raw = p.restricted_until as string | null
        if (raw === "infinity" || (raw && new Date(raw).getTime() > now))
          restrictedAuthors.add(p.id)
      }
    }

    // 2. Process each piece
    for (const piece of readyPieces) {
      const authorDetails = piece.author as any as {
        display_name: string
        handle: string
      } | null

      if (restrictedAuthors.has(piece.author_id)) {
        const { error: revertError } = await supabaseAdmin
          .from("content_objects")
          .update({ status: "draft" })
          .eq("id", piece.id)
        if (revertError)
          console.error(`[Cron Publish] Failed to revert restricted piece ${piece.id}:`, revertError)
        else revertedIds.push(piece.id)
        continue
      }

      // Update piece status to published
      const { error: updateError } = await supabaseAdmin
        .from("content_objects")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          // keep scheduled_for intact for historical purposes or set to null
        })
        .eq("id", piece.id)

      if (updateError) {
        console.error(
          `[Cron Publish] Failed to update piece ${piece.id}:`,
          updateError
        )
        continue
      }

      publishedIds.push(piece.id)

      // Send email notifications
      try {
        const { data: follows } = await supabaseAdmin
          .from("follows")
          .select("follower_id")
          .eq("author_id", piece.author_id)

        const followerIds = (follows ?? []).map(
          (f: { follower_id: string }) => f.follower_id
        )

        if (followerIds.length > 0) {
          // Followers + guest email subscribers (paginated + deduped).
          const { getAuthorRecipientEmails } = await import(
            "@/lib/newsletter-recipients"
          )
          const recipientEmails = await getAuthorRecipientEmails(
            supabaseAdmin,
            piece.author_id
          )

          if (recipientEmails.length > 0 && authorDetails) {
            await sendPublishEmail({
              authorName: authorDetails.display_name,
              authorHandle: authorDetails.handle,
              authorId: piece.author_id,
              pieceTitle: piece.title,
              pieceSummary: piece.summary || "",
              pieceSlug: piece.slug,
              recipientEmails,
            })
          }
        }
      } catch (err) {
        console.error(
          `[Cron Publish] Failed to send notification emails for piece ${piece.id}:`,
          err
        )
      }
    }

    if (publishedIds.length) revalidateTag("public", "max")

    return NextResponse.json({
      success: true,
      count: publishedIds.length,
      publishedIds,
      revertedIds,
    })
  } catch (err) {
    console.error("[Cron Publish] Unexpected error:", err)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

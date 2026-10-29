/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"

import { CONTACT_EMAIL } from "@/lib/brand"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { render } from "react-email"
import nodemailer from "nodemailer"
import { NibDispatchEmail } from "@/emails/nib-dispatch"
import { sendBulkDispatch } from "@/lib/newsletter-send"
import { fromName } from "@/lib/email-layout"
import React from "react"

export async function dispatchNewsletter(_args: { data?: any } = {}) {
  const data = _args.data as { pieceId: string; previewOnly?: boolean }
  const pieceId = data.pieceId
  const previewOnly = data.previewOnly || false

  const supabase = await createAdminClient()
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  if (!user) throw new Error("Unauthorized")

  // Fetch piece details
  const { data: piece } = await supabase
    .from("content_objects")
    .select(
      "title, summary, slug, status, author_id, profiles(display_name, handle, avatar_url)"
    )
    .eq("id", pieceId)
    .single()

  if (!piece) throw new Error("Piece not found")
  if (piece.author_id !== user.id)
    throw new Error("Unauthorized to dispatch this piece")

  const profiles = Array.isArray(piece.profiles)
    ? piece.profiles[0]
    : piece.profiles
  const authorName = profiles?.display_name || "Author"
  const authorHandle = profiles?.handle || "author"
  const authorAvatar = profiles?.avatar_url || ""
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const pieceUrl = `${appUrl}/u/${authorHandle}/${piece.slug}`

  // Fetch audience: followers + CONFIRMED guest subscribers, minus unsubscribes.
  // Needs the service role (listUsers + RLS-locked suppression table).
  const svc = supabase
  const { getAuthorRecipientEmails } = await import(
    "@/lib/newsletter-recipients"
  )
  const recipientEmails = await getAuthorRecipientEmails(svc, user.id)
  const recipientsCount = recipientEmails.length

  // Render once with a sentinel unsubscribe URL, then swap in each recipient's
  // personalized link per-send — one render, N cheap string replacements.
  const UNSUB_SENTINEL = "__NIB_UNSUB__"
  const html = await render(
    React.createElement(NibDispatchEmail, {
      authorName,
      authorAvatar,
      pieceTitle: piece.title,
      pieceSummary: piece.summary || "A new piece has been published.",
      pieceUrl,
      unsubscribeUrl: UNSUB_SENTINEL,
    })
  )

  const subject = `${authorName} published: ${piece.title}`

  if (previewOnly) {
    // Preview gets a dead unsubscribe link — it's not a real send.
    return {
      success: true,
      html: html.split(UNSUB_SENTINEL).join("#"),
      subject,
      recipientsCount,
    }
  }

  // Never email a draft/scheduled piece — the link would 404 and recipients
  // can't be un-emailed. Gate on the server so no caller can bypass it.
  if (piece.status !== "published") {
    return {
      success: false,
      error: "Publish the piece before sending it as a newsletter.",
    }
  }

  if (recipientEmails.length === 0) {
    return { success: false, error: "No followers with email addresses yet." }
  }

  const { getTransporter } = await import("@/lib/email")
  const transporter = await getTransporter()
  if (!transporter) {
    console.warn("[email] SMTP_HOST not set; newsletter not sent")
    return { success: false, error: "Email sending is not configured." }
  }
  const from = `"${fromName(authorName)} on Nib" <${process.env.EMAIL_FROM ?? CONTACT_EMAIL}>`

  // One personalized email per recipient so each carries its own working
  // unsubscribe link + one-click headers.
  const { sent, queued, lost, lastInfo } = await sendBulkDispatch({
    transporter,
    from,
    subject,
    recipients: recipientEmails,
    authorId: user.id,
    appUrl,
    html: (unsubUrl) => html.split(UNSUB_SENTINEL).join(unsubUrl),
  })

  // Log to database
  await supabase.from("newsletter_dispatches").insert({
    author_id: user.id,
    piece_id: pieceId,
    subject,
    recipient_count: sent,
    status: lost > 0 ? "partial" : queued > 0 ? "queued" : "sent",
  })

  return {
    success: true,
    messageId: lastInfo?.messageId,
    previewUrl: lastInfo ? nodemailer.getTestMessageUrl(lastInfo) : undefined,
    recipientsCount: sent,
    queuedCount: queued,
    lostCount: lost,
  }
}

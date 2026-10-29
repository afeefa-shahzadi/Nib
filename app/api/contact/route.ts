import { CONTACT_EMAIL } from "@/lib/brand"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import nodemailer from "nodemailer"
import { queueIfRateLimited } from "@/lib/email-outbox"
import { escapeHtml } from "@/lib/html"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { fullName, email, organizationName, phoneNumber, intent, expectedSeats, timeline, details } = body

    if (!fullName || !email || !organizationName || !intent) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabaseAdmin = await createAdminClient()

    // 1. Save to database
    const { error: dbError } = await supabaseAdmin
      .from("leads")
      .insert({
        full_name: fullName,
        email,
        organization_name: organizationName,
        phone_number: phoneNumber,
        intent,
        expected_seats: expectedSeats,
        timeline,
        details,
        status: "new",
      })

    if (dbError) {
      console.error("[leads] Database insertion error", dbError)
      return NextResponse.json({ error: "Could not save lead" }, { status: 500 })
    }

    // Lead fields are untrusted form input: escape before putting them in HTML.
    const e = (v: unknown) => escapeHtml(String(v || "N/A"))
    const htmlContent = `
      <h2>New ${e(intent)} Lead</h2>
      <p><strong>Name:</strong> ${e(fullName)}</p>
      <p><strong>Email:</strong> ${e(email)}</p>
      <p><strong>Organization:</strong> ${e(organizationName)}</p>
      <p><strong>Phone:</strong> ${e(phoneNumber)}</p>
      <p><strong>Expected Seats:</strong> ${e(expectedSeats)}</p>
      <p><strong>Timeline:</strong> ${e(timeline)}</p>
      <p><strong>Details:</strong> ${e(details)}</p>
    `

    // 2. Send Email (non-blocking if it fails we still saved it)
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })



      // If SMTP is configured, send the email
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        await transporter.sendMail({
          from: `"Nib Leads" <${process.env.SMTP_USER}>`,
          to: CONTACT_EMAIL,
          subject: `New Lead: ${organizationName} (${intent})`,
          html: htmlContent,
        })
      } else {
        console.warn("[leads] SMTP not configured. Did not send email, but saved to DB.")
      }
    } catch (emailError) {
      const queued = await queueIfRateLimited(emailError, {
        to_email: CONTACT_EMAIL,
        from_email: `"Nib Leads" <${process.env.SMTP_USER}>`,
        subject: `New Lead: ${organizationName} (${intent})`,
        html: htmlContent,
      })
      if (!queued) console.error("[leads] Email sending failed", emailError)
      // We don't throw here because the lead is safely in the DB
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error("[leads] Handler error", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

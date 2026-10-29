import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { hasStudioAccess } from "@/lib/plan"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const profileId = session.user.id

  // Verify the user is a creator
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", profileId)
    .eq("role", "creator")
    .single()

  if (!roles) {
    return NextResponse.json(
      { error: "Forbidden. Creators only." },
      { status: 403 }
    )
  }

  // Fetch Profile to check plan
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", profileId)
    .single()

  const hasStudio = hasStudioAccess(profile?.plan)
  if (!hasStudio) {
    return NextResponse.json(
      { error: "Forbidden. Studio or Organizations plan required." },
      { status: 403 }
    )
  }

  // Fetch followers/subscribers
  const { data: follows, error } = await supabase
    .from("follows")
    .select(
      "created_at, follower:profiles!follower_id(id, display_name, handle)"
    )
    .eq("author_id", profileId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching subscribers:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }

  // Construct CSV
  const header = "Subscriber ID,Display Name,Handle,Followed At\n"
  const rows = follows.map((f) => {
    const user =
      (f.follower as { id?: string; display_name?: string; handle?: string }) ||
      {}
    const id = user.id || ""
    // Escape quotes in display name
    const name = `"${(user.display_name || "").replace(/"/g, '""')}"`
    const handle = user.handle || ""
    const date = new Date(f.created_at).toISOString()
    return `${id},${name},${handle},${date}`
  })

  const csv = header + rows.join("\n")

  // Return as downloadable file
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="subscribers_export_${new Date().toISOString().split("T")[0]}.csv"`,
    },
  })
}

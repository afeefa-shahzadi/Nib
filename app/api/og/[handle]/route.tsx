import { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { ogCard } from "@/lib/og-card"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const supabaseAdmin = await createAdminClient()
  const { data: author } = await supabaseAdmin
    .from("profiles")
    .select("handle, display_name, bio")
    .eq("handle", handle)
    .maybeSingle()
  if (!author) return new Response("Not found", { status: 404 })
  return ogCard({ title: author.display_name || `@${author.handle}`, subtitle: author.bio, footer: `@${author.handle} on Nib` })
}

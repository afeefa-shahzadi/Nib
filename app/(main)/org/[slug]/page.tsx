import { Building2, Users, FileText } from "lucide-react"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"

export default async function OrgIntranetPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  
  const supabaseAdmin = await createAdminClient()
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) redirect("/login")
  
  // Find the org by slug
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", slug)
    .single()
    
  if (!org) notFound()
  
  // Check membership
  const { data: membership } = await supabaseAdmin
    .from("org_members")
    .select("role")
    .eq("org_id", org.id)
    .eq("user_id", user.id)
    .single()
    
  if (!membership) {
    return (
      <div className="container-wide min-h-screen max-w-5xl pt-16 pb-12 md:pt-24 text-center">
        <h1 className="text-3xl font-display font-bold mb-4">Access Denied</h1>
        <p className="text-muted-foreground">You are not a member of this organization.</p>
      </div>
    )
  }
  
  // Fetch org docs (content objects)
  const { data: docs } = await supabaseAdmin
    .from("content_objects")
    .select("id, title, updated_at")
    .eq("org_id", org.id)
    .order("updated_at", { ascending: false })
    .limit(10)
    
  // Fetch directory members
  const { data: members } = await supabaseAdmin
    .from("org_members")
    .select("user_id, role")
    .eq("org_id", org.id)
    
  // We need profiles for the members
  let memberProfiles: { id: string; display_name: string; handle: string | null; role: string | undefined }[] = []
  if (members && members.length > 0) {
    const userIds = members.map(m => m.user_id)
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, handle")
      .in("id", userIds)
    
    if (profiles) {
      memberProfiles = profiles.map(p => {
        const mem = members.find(m => m.user_id === p.id)
        return { ...p, role: mem?.role }
      })
    }
  }
  
  return (
    <div className="container-wide min-h-screen max-w-5xl pt-16 pb-12 md:pt-24">
      <div className="flex items-center gap-4 mb-8 border-b pb-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
          <Building2 className="size-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold">{org.name} Intranet</h1>
          <p className="text-muted-foreground mt-1 tracking-wider text-sm uppercase">Private Workspace for {org.slug}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="surface rounded-xl p-6 border border-border/60 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
              <FileText className="size-5 text-info" />
            </div>
            <h2 className="text-xl font-semibold">Internal Documents</h2>
          </div>
          <p className="text-muted-foreground mb-4">
            Access private drafts, guidelines, and shared resources restricted to organization members.
          </p>
          <div className="space-y-3">
            {!docs || docs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No documents found.</p>
            ) : (
              docs.map((doc) => (
                <Link href={`/studio/drafts/${doc.id}`} key={doc.id}>
                  <div className="flex items-center justify-between p-3 rounded bg-accent/30 hover:bg-accent/50 cursor-pointer transition-colors mb-2">
                    <span className="font-medium text-sm">{doc.title || "Untitled Document"}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(doc.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="surface rounded-xl p-6 border border-border/60 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Users className="size-5 text-success" />
            </div>
            <h2 className="text-xl font-semibold">Directory</h2>
          </div>
          <p className="text-muted-foreground mb-4">
            Find and collaborate with other members of your organization.
          </p>
          <div className="space-y-3">
            {!memberProfiles || memberProfiles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No members found.</p>
            ) : (
              memberProfiles.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded bg-accent/30 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs">
                      {(member.display_name?.[0] || member.handle?.[0] || "?").toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{member.display_name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">@{member.handle}</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground bg-background px-2 py-1 rounded">
                    {member.role}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

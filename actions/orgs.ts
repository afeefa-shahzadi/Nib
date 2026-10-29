/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"
import { ActionContext } from "@/lib/types/actions"
import { hasOrgAccess } from "@/lib/plan"

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "org"

const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(18)))
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 32)

interface OrgInfo {
  id: string
  slug: string
  name: string
  plan: string
  seats: number
  owner_id: string
  created_at: string
}

export async function listMyOrgs() {
  noStore()
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({ context }: { context: ActionContext }) => {
    const { data: rows } = await context.supabase
      .from("org_members")
      .select(
        "org_id, role, organizations:org_id(id, slug, name, plan, seats, owner_id, created_at)"
      )
      .eq("user_id", context.userId!)
    return (rows ?? [])
      .map(
        (r: { role: string; organizations: OrgInfo | OrgInfo[] | null }) => ({
          role: r.role,
          org:
            (Array.isArray(r.organizations)
              ? r.organizations[0]
              : r.organizations) ?? null,
        })
      )
      .filter((r: { role: string; org: OrgInfo | null }) => r.org)
  }
  return await __handler({ context })
}

export async function createOrg(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { name: string; seats?: number }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Unauthorized")
    const { data: profile } = await context.supabase.from("profiles").select("plan").eq("id", context.userId).single()
    if (!hasOrgAccess(profile?.plan)) {
      throw new Error("This feature requires the Organizations plan.")
    }

    const base = slugify(data.name)
    let slug = base
    for (let i = 1; i < 30; i++) {
      const { data: existing } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .maybeSingle()
      if (!existing) break
      slug = `${base}-${i}`
    }
    const serviceClient = supabaseAdmin

    const { data: row, error } = await serviceClient
      .from("organizations")
      .insert({
        name: data.name,
        slug,
        plan: "org",
        owner_id: context.userId!,
        seats: data.seats ?? 3,
      })
      .select("id, slug, name, plan, seats")
      .single()

    if (!error && row) {
      // automatically make them the owner
      await serviceClient.from("org_members").insert({
        org_id: row.id,
        user_id: context.userId!,
        role: "owner"
      })
    }
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    revalidatePath("/studio/org")
    return row
  }
  return await __handler({
    data: args?.data as { name: string; seats?: number },
    context,
  })
}

export async function getOrgDetail(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { org_id: string }
    context: ActionContext
  }) => {
    const { data: caller } = await context.supabase
      .from("org_members")
      .select("role")
      .eq("org_id", data.org_id)
      .eq("user_id", context.userId!)
      .maybeSingle()
    // Only members may read org details (member list, invite tokens).
    if (!caller) throw new Error("Not authorized")

    const { data: org } = await context.supabase
      .from("organizations")
      .select(
        "id, slug, name, plan, seats, owner_id, created_at"
      )
      .eq("id", data.org_id)
      .single()
    if (!org) throw new Error("Org not found.")
    const { data: members } = await context.supabase
      .from("org_members")
      .select("id, user_id, role, created_at")
      .eq("org_id", data.org_id)
    const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id)
    const { data: profiles } = memberIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, handle, display_name, avatar_url")
          .in("id", memberIds)
      : { data: [] }
    const map = new Map(
      (profiles ?? []).map(
        (p: {
          id: string
          handle: string | null
          display_name: string
          avatar_url: string | null
        }) => [p.id, p]
      )
    )
    const myRole =
      members?.find((m: { user_id: string }) => m.user_id === context.userId!)
        ?.role ?? null
    const { data: invites } = await context.supabase
      .from("org_invites")
      .select("id, email, role, token, accepted_at, created_at")
      .eq("org_id", data.org_id)
    return {
      org,
      myRole,
      members: (members ?? []).map(
        (m: {
          id: string
          user_id: string
          role: string
          created_at: string
        }) => ({
          ...m,
          profile: map.get(m.user_id) ?? null,
        })
      ),
      invites: invites ?? [],
    }
  }
  return await __handler({
    data: args?.data as { org_id: string },
    context,
  })
}

export async function inviteToOrg(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { org_id: string; email: string; role?: string }
    context: ActionContext
  }) => {
    const { data: caller } = await context.supabase
      .from("org_members")
      .select("role")
      .eq("org_id", data.org_id)
      .eq("user_id", context.userId!)
      .single()

    if (!caller || (caller.role !== "owner" && caller.role !== "admin")) {
      throw new Error("Unauthorized: You must be an admin or owner to invite members.")
    }

    const { error } = await context.supabase.from("org_invites").insert({
      org_id: data.org_id,
      email: data.email.toLowerCase(),
      // Only member/admin: an invite must never mint an owner.
      role: data.role === "admin" ? "admin" : "member",
      token: token(),
      invited_by: context.userId!,
    })
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { ok: true }
  }
  return await __handler({
    data: args?.data as { org_id: string; email: string; role?: string },
    context,
  })
}

export async function bulkInviteMembers(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { org_id: string; emails: string[]; role?: string }
    context: ActionContext
  }) => {
    const { data: caller } = await context.supabase
      .from("org_members")
      .select("role")
      .eq("org_id", data.org_id)
      .eq("user_id", context.userId!)
      .single()

    if (!caller || (caller.role !== "owner" && caller.role !== "admin")) {
      throw new Error("Unauthorized: You must be an admin or owner to invite members.")
    }

    const invitesToInsert = data.emails.map(email => ({
      org_id: data.org_id,
      email: email.toLowerCase(),
      role: data.role === "admin" ? "admin" : "member",
      token: token(),
      invited_by: context.userId!,
    }))

    const { error } = await context.supabase.from("org_invites").insert(invitesToInsert)
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { ok: true, count: invitesToInsert.length }
  }
  return await __handler({
    data: args?.data as { org_id: string; emails: string[]; role?: string },
    context,
  })
}

export async function acceptOrgInvite(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { token: string }
    context: ActionContext
  }) => {
    if (!context.userId) throw new Error("Sign in to accept this invite.")
    // The invitee is not an org admin, so RLS hides org_invites from them and
    // org_members has no user write policy: the cookie client read nothing
    // (or silently failed the insert) and every invite link was a no-op.
    // Identity is checked above/below; the writes go through the service role.
    const svc = supabaseAdmin
    const { data: inv } = await svc
      .from("org_invites")
      .select("id, org_id, role, email, accepted_at")
      .eq("token", data.token)
      .maybeSingle()
    if (!inv || inv.accepted_at)
      throw new Error("Invite is invalid or already used.")
    // An invite is for the address it was sent to, not whoever holds the link.
    if (inv.email.toLowerCase() !== (context.user?.email ?? "").toLowerCase())
      throw new Error(`This invite was sent to ${inv.email}. Sign in with that address to accept it.`)
    const { error: mErr } = await svc
      .from("org_members")
      .insert({ org_id: inv.org_id, user_id: context.userId, role: inv.role })
    if (mErr && mErr.code !== "23505") {
      console.error("[server]", mErr)
      throw new Error("Couldn't join the organization. Please try again.")
    }
    await svc
      .from("org_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", inv.id)
    return { ok: true, org_id: inv.org_id }
  }
  return await __handler({
    data: args?.data as { token: string },
    context,
  })
}

export async function removeOrgMember(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { member_id: string }
    context: ActionContext
  }) => {
    const { data: targetMember } = await context.supabase
      .from("org_members")
      .select("org_id, role, user_id")
      .eq("id", data.member_id)
      .single()

    if (!targetMember) throw new Error("Member not found.")

    if (targetMember.user_id !== context.userId!) {
      const { data: caller } = await context.supabase
        .from("org_members")
        .select("role")
        .eq("org_id", targetMember.org_id)
        .eq("user_id", context.userId!)
        .single()

      if (!caller || (caller.role !== "owner" && caller.role !== "admin")) {
        throw new Error("Unauthorized: You must be an admin or owner to remove members.")
      }
      if (caller.role === "admin" && targetMember.role === "owner") {
        throw new Error("Unauthorized: Admins cannot remove the organization owner.")
      }
    } else if (targetMember.role === "owner") {
      throw new Error("The owner cannot leave the organization without transferring ownership first.")
    }

    const serviceClient = supabaseAdmin

    const { error } = await serviceClient
      .from("org_members")
      .delete()
      .eq("id", data.member_id)
      
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { ok: true }
  }
  return await __handler({
    data: args?.data as { member_id: string },
    context,
  })
}

export async function deleteInvite(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { invite_id: string }
    context: ActionContext
  }) => {
    const { data: invite } = await context.supabase
      .from("org_invites")
      .select("org_id")
      .eq("id", data.invite_id)
      .single()

    if (!invite) throw new Error("Invite not found.")

    const { data: caller } = await context.supabase
      .from("org_members")
      .select("role")
      .eq("org_id", invite.org_id)
      .eq("user_id", context.userId!)
      .single()

    if (!caller || (caller.role !== "owner" && caller.role !== "admin")) {
      throw new Error("Unauthorized: You must be an admin or owner to manage invites.")
    }

    const serviceClient = supabaseAdmin

    const { error } = await serviceClient
      .from("org_invites")
      .delete()
      .eq("id", data.invite_id)
      
    if (error) {
      console.error("[server]", error)
      throw new Error("Request failed. Please try again.")
    }
    return { ok: true }
  }
  return await __handler({
    data: args?.data as { invite_id: string },
    context,
  })
}

export async function deleteOrg(args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: _auth } = await (await createClient()).auth.getUser()
  const context: ActionContext = {
    user: _auth?.user,
    userId: _auth?.user?.id,
    supabase: supabaseAdmin,
  }

  const __handler = async ({
    data,
    context,
  }: {
    data: { org_id: string }
    context: ActionContext
  }) => {
    // Verify caller is owner
    const { data: caller } = await context.supabase
      .from("org_members")
      .select("role")
      .eq("org_id", data.org_id)
      .eq("user_id", context.userId!)
      .single()

    if (!caller || caller.role !== "owner") {
      throw new Error("Unauthorized: Only the owner can delete the organization.")
    }

    const serviceClient = supabaseAdmin

    const { data: deletedRows, error } = await serviceClient
      .from("organizations")
      .delete()
      .eq("id", data.org_id)
      .select()

    if (error) {
      console.error("[server] deleteOrg:", error)
      throw new Error("Failed to delete organization.")
    }
    
    if (!deletedRows || deletedRows.length === 0) {
      throw new Error("Failed to delete: Organization may have active references blocking deletion, or doesn't exist.")
    }
    
    revalidatePath("/studio/org")
    return { ok: true }
  }

  return await __handler({
    data: args?.data as { org_id: string },
    context,
  })
}

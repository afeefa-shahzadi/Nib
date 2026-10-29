"use client"
import { useEffect, useState, useCallback } from "react"
import {
  listMyOrgs,
  createOrg,
  getOrgDetail,
  inviteToOrg,
  removeOrgMember,
  deleteInvite,
  deleteOrg,
  acceptOrgInvite,
} from "@/actions/orgs"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Building2,
  Mail,
  Trash2,
  UserPlus,
  Copy,
  Plus,
  ChevronRight,
  X,
  Lock,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import Image from "next/image"
import Link from "next/link"
import { Org, Member, Invite } from "@/lib/types/content"
import { useMyPlan } from "@/hooks/use-my-plan"
import { BulkInvite } from "@/components/org/bulk-invite"

export default function OrgPage() {
  const list = listMyOrgs
  const create = createOrg
  const detail = getOrgDetail
  const invite = inviteToOrg
  const remove = removeOrgMember
  const delInvite = deleteInvite
  const delOrg = deleteOrg

  const [mounted, setMounted] = useState(false)
  useEffect(() => queueMicrotask(() => setMounted(true)), [])

  const { plan, loading: planLoading } = useMyPlan()
  const hasOrg = plan === "org"

  const [showCreate, setShowCreate] = useState(false)

  const [orgs, setOrgs] = useState<Array<{ role: string; org: Org }>>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [data, setData] = useState<{
    org: Org
    myRole: string | null
    members: Member[]
    invites: Invite[]
  } | null>(null)

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member")

  const refreshList = useCallback(() => {
    list().then((rows) => {
      setOrgs(rows as Array<{ role: string; org: Org }>)
      setActiveId(currentId => {
        if (!currentId && rows.length > 0) return rows[0].org!.id
        return currentId
      })
    })
  }, [list])

  useEffect(() => {
    refreshList()
  }, [refreshList])

  // Invite links ("Copy invite link") land here as ?invite=<token>.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("invite")
    if (!t) return
    window.history.replaceState(null, "", "/studio/org")
    acceptOrgInvite({ data: { token: t } })
      .then((r) => {
        toast.success("You joined the organization")
        refreshList()
        setActiveId(r.org_id)
      })
      .catch((e: Error) => toast.error(e.message))
  }, [refreshList])

  useEffect(() => {
    if (!activeId) {
      requestAnimationFrame(() => {
        setData(null)
      })
      return
    }
    detail({ data: { org_id: activeId } })
      .then(setData)
      .catch((e) => {
        console.error("Detail fetch error:", e)
        toast.error(e.message)
      })
  }, [activeId, detail])

  const onCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const o = await create({ data: { name: newName.trim() } })
      toast.success("Organization created")
      setNewName("")
      setShowCreate(false)
      await refreshList()
      setActiveId(o.id)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const onDeleteOrg = async () => {
    if (!activeId) return
    try {
      await delOrg({ data: { org_id: activeId } })
      toast.success("Organization deleted")
      setActiveId(null)
      setData(null)
      await refreshList()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const onInvite = async () => {
    if (!activeId || !inviteEmail.trim()) return
    try {
      await invite({
        data: { org_id: activeId, email: inviteEmail.trim(), role: inviteRole },
      })
      toast.success("Invite created")
      setInviteEmail("")
      detail({ data: { org_id: activeId } }).then(setData)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const copyInvite = (t: string) => {
    const url = `${window.location.origin}/studio/org?invite=${t}`
    navigator.clipboard.writeText(url)
    toast.success("Invite link copied")
  }

  const onRemoveMember = async (id: string) => {
    if (!activeId) return
    if (!confirm("Remove this member?")) return
    try {
      await remove({ data: { member_id: id } })
      detail({ data: { org_id: activeId } }).then(setData)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const onDeleteInvite = async (id: string) => {
    if (!activeId) return
    try {
      await delInvite({ data: { invite_id: id } })
      detail({ data: { org_id: activeId } }).then(setData)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const canAdmin = data?.myRole === "owner" || data?.myRole === "admin"

  if (!mounted || planLoading) {
    return (
      <div className="mx-auto w-full max-w-350 p-6 md:p-8">
        <div className="h-32 w-full animate-pulse rounded-md bg-muted/20" />
      </div>
    )
  }

  if (!hasOrg) {
    return (
      <div className="mx-auto w-full max-w-350 p-6 md:p-8">
        <div className="surface-elevated mt-12 flex flex-col items-center justify-center gap-4 rounded-md p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="size-6 text-primary" />
          </div>
          <h2 className="font-display text-2xl">Organizations plan required</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Shared workspaces, org-only debate rooms, and member roles are available on the Organizations plan.
          </p>
          <Link href="/pricing">
            <Button className="mt-2">Upgrade to Organizations</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-350 p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Studio
          </p>
          <h1 className="font-display text-3xl text-foreground">
            Organizations
          </h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? (
              <>
                <X className="mr-2 size-4" /> Close
              </>
            ) : (
              <>
                <Plus className="mr-2 size-4" /> Create organization
              </>
            )}
          </Button>
        </div>
      </div>

      {showCreate && (
        <div className="surface mb-10 flex flex-wrap items-end gap-4 rounded-md border border-border/60 p-6">
          <div className="min-w-0 flex-1">
            <Label>Organization name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Sequoia Research"
              className="mt-2"
            />
          </div>
          <Button
            onClick={onCreate}
            disabled={creating || !newName.trim()}
          >
            <Plus className="mr-2 size-4" /> Create
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Left: list (Desktop) */}
        <aside className="hidden space-y-3 lg:block">
          <div className="surface space-y-0.5 rounded-md p-1.5">
            {orgs.length === 0 && (
              <p className="p-3 text-xs text-muted-foreground">
                No organizations yet.
              </p>
            )}
            {orgs.map(({ org, role }) => (
              <button
                key={org.id}
                onClick={() => setActiveId(org.id)}
                className={`flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm transition-colors ${
                  activeId === org.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                }`}
              >
                <Building2 className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">
                    {org.name}
                  </span>
                  <span className="block text-[10px] tracking-wider text-muted-foreground uppercase">
                    {role}
                  </span>
                </span>
                <ChevronRight className="size-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </aside>

        {/* Right: detail */}
        <section className="min-w-0 space-y-6">
          {/* Mobile Switcher */}
          <div className="lg:hidden">
            <Label className="mb-2 block text-xs tracking-wider text-muted-foreground uppercase">
              Select Organization
            </Label>
            <Select
              value={activeId || ""}
              onValueChange={setActiveId}
              disabled={orgs.length === 0}
            >
              <SelectTrigger className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm">
                <SelectValue
                  placeholder={
                    orgs.length === 0
                      ? "No organizations yet"
                      : "Select organization..."
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {orgs.map(({ org, role }) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}{" "}
                    <span className="ml-1 text-[10px] text-muted-foreground uppercase">
                      ({role})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!data && (
            <div className="surface rounded-md p-12 text-center text-sm text-muted-foreground">
              Select or create an organization.
            </div>
          )}
          {data && (
            <>
              <div className="surface-elevated rounded-md p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs tracking-wider text-primary uppercase">
                      {data.org.plan}
                    </p>
                    <h2 className="mt-1 font-display text-2xl text-foreground">
                      {data.org.name}
                    </h2>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      /{data.org.slug}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-3xl text-foreground tabular-nums">
                      {data.members.length}
                      <span className="text-base text-muted-foreground">
                        /{data.org.seats}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">seats used</p>
                    {data.myRole === "owner" && (
                      <div className="mt-4">
                        <ConfirmDialog
                          trigger={
                            <Button variant="outline" size="sm" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive">
                              <Trash2 className="mr-2 size-3" /> Delete
                            </Button>
                          }
                          title="Delete organization?"
                          description="This cannot be undone and will remove all members, rooms, and billing subscriptions associated with it."
                          destructive
                          confirmLabel="Delete organization"
                          onConfirm={onDeleteOrg}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Invite */}
              {canAdmin && (
                <div className="surface rounded-md p-5">
                  <p className="mb-3 flex items-center gap-1 text-xs tracking-wider text-muted-foreground uppercase">
                    <UserPlus className="size-3" /> Invite by email
                  </p>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <Input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      type="email"
                      placeholder="name@example.com"
                      className="h-9"
                    />
                    <Select
                      value={inviteRole}
                      onValueChange={(v) =>
                        setInviteRole(v as "admin" | "member")
                      }
                    >
                      <SelectTrigger className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={onInvite}
                      disabled={!inviteEmail.trim()}
                      size="sm"
                    >
                      Invite
                    </Button>
                  </div>
                  {data.invites.filter((i) => !i.accepted_at).length > 0 && (
                    <ul className="mt-4 space-y-1.5">
                      {data.invites
                        .filter((i) => !i.accepted_at)
                        .map((inv) => (
                          <li
                            key={inv.id}
                            className="flex items-center gap-3 rounded px-2 py-1.5 text-sm hover:bg-accent/40"
                          >
                            <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate">{inv.email}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {inv.role}
                            </Badge>
                            <button
                              onClick={() => copyInvite(inv.token)}
                              className="text-muted-foreground hover:text-foreground"
                              title="Copy link"
                            >
                              <Copy className="size-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteInvite(inv.id)}
                              className="text-muted-foreground hover:text-destructive"
                              title="Revoke"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Bulk Invite */}
              {canAdmin && (
                <div className="mt-6">
                  <BulkInvite orgId={data.org.id} />
                </div>
              )}

              {/* Members */}
              <div className="surface rounded-md p-5">
                <p className="mb-3 text-xs tracking-wider text-muted-foreground uppercase">
                  Members
                </p>
                <ul className="divide-y divide-border">
                  {data.members.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 py-2.5">
                      <div className="size-8 shrink-0 overflow-hidden rounded-full bg-muted">
                        {m.profile?.avatar_url ? (
                          <Image
                            src={m.profile.avatar_url}
                            alt=""
                            width={32}
                            height={32}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-xs">
                            {(m.profile?.display_name ?? "?").charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">
                          {m.profile?.handle ? (
                            <Link
                              href={`/u/${m.profile.handle}`}
                              className="hover:text-primary"
                            >
                              {m.profile.display_name}
                            </Link>
                          ) : m.profile ? (
                            <span>{m.profile.display_name}</span>
                          ) : (
                            "Unknown user"
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          @{m.profile?.handle ?? "—"}
                        </p>
                      </div>
                      <Badge
                        variant={m.role === "owner" ? "default" : "outline"}
                        className="text-[10px] uppercase"
                      >
                        {m.role}
                      </Badge>
                      {canAdmin && m.role !== "owner" && (
                        <button
                          onClick={() => onRemoveMember(m.id)}
                          className="text-muted-foreground hover:text-destructive"
                          title="Remove"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Per-seat billing (Razorpay) ships in the next batch alongside
                org-restricted breakout rooms.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

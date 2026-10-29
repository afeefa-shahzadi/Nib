"use client"

import { useQuery } from "@tanstack/react-query"
import { listMyPieces, listMyTiers } from "@/actions/content"
import {
  createRoom,
  deleteRoom,
  listRoomsForPiece,
  searchInvitableUsers,
} from "@/actions/debate"
import { listMyOrgs } from "@/actions/orgs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ACCESS_LABEL } from "@/lib/content/debates/data"
import { AccessMode, InvitableUser, Room } from "@/lib/types/content"

export default function DebatesPage() {
  const piecesFn = listMyPieces
  const tiersFn = listMyTiers
  const listFn = listRoomsForPiece
  const createFn = createRoom
  const delFn = deleteRoom
  const searchFn = searchInvitableUsers
  const orgsFn = listMyOrgs

  const pq = useQuery({
    queryKey: ["my-pieces-debates"],
    queryFn: () => piecesFn(),
  })
  const tq = useQuery({
    queryKey: ["my-tiers-debates"],
    queryFn: () => tiersFn(),
  })
  const oq = useQuery({
    queryKey: ["my-orgs-debates"],
    queryFn: () => orgsFn(),
  })

  const [pieceId, setPieceId] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState("")
  const [prompt, setPrompt] = useState("")
  const [accessMode, setAccessMode] = useState<AccessMode>("public")
  const [requiredTierId, setRequiredTierId] = useState<string>("")
  const [orgId, setOrgId] = useState<string>("")
  const [inviteQuery, setInviteQuery] = useState("")
  const [inviteResults, setInviteResults] = useState<InvitableUser[]>([])
  const [invitees, setInvitees] = useState<InvitableUser[]>([])
  const [rooms, setRooms] = useState<Room[]>([])

  useEffect(() => {
    if (!pieceId) {
      requestAnimationFrame(() => {
        setRooms([])
      })
      return
    }
    listFn({ data: { content_object_id: pieceId } })
      .then((r) => setRooms(r as Room[]))
      .catch(() => setRooms([]))
  }, [pieceId, listFn])

  useEffect(() => {
    if (accessMode !== "invite") return
    const t = setTimeout(() => {
      searchFn({ data: { query: inviteQuery } })
        .then(setInviteResults)
        .catch(() => setInviteResults([]))
    }, 200)
    return () => clearTimeout(t)
  }, [accessMode, inviteQuery, searchFn])

  function addInvitee(u: InvitableUser) {
    if (invitees.find((i) => i.id === u.id)) return
    setInvitees([...invitees, u])
  }
  function removeInvitee(id: string) {
    setInvitees(invitees.filter((i) => i.id !== id))
  }

  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!pieceId || !title.trim())
      return toast.error("Pick a piece and add a title")
    if (accessMode === "tier" && !requiredTierId)
      return toast.error("Pick a tier")
    if (accessMode === "invite" && invitees.length === 0)
      return toast.error("Add at least one person to invite")
    if (accessMode === "org" && !orgId)
      return toast.error("Pick an organization")
    try {
      await createFn({
        data: {
          content_object_id: pieceId,
          title: title.trim(),
          prompt: prompt.trim() || null,
          access_mode: accessMode,
          required_tier_id: accessMode === "tier" ? requiredTierId : null,
          org_id: accessMode === "org" ? orgId : null,
          invite_user_ids:
            accessMode === "invite" ? invitees.map((i) => i.id) : undefined,
        },
      })
      toast.success("Debate room created")
      setShowCreate(false)
      setTitle("")
      setPrompt("")
      setInvitees([])
      setInviteQuery("")
      const r = await listFn({ data: { content_object_id: pieceId } })
      setRooms(r as Room[])
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function remove(id: string) {
    try {
      await delFn({ data: { id } })
      setRooms((rs) => rs.filter((r) => r.id !== id))
      toast.success("Room deleted")
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const tiers = tq.data ?? []

  return (
    <div className="mx-auto w-full max-w-350 p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Debates
          </p>
          <h1 className="font-display text-3xl text-foreground">
            Breakout rooms
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
                <Plus className="mr-2 size-4" /> Create room
              </>
            )}
          </Button>
        </div>
      </div>

      {showCreate && (
        <form
          onSubmit={submit}
          className="surface mb-10 grid gap-4 rounded-md border border-border/60 p-6 md:grid-cols-2"
        >
          <div className="min-w-0">
            <Label>Piece</Label>
            <Select
              value={pieceId || "empty"}
              onValueChange={(v) => setPieceId(v === "empty" ? "" : v)}
            >
              <SelectTrigger className="h-10 w-full rounded border border-border bg-background px-3 text-sm">
                <SelectValue placeholder="— choose —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="empty">— choose —</SelectItem>
                {(pq.data ?? []).map((p: { id: string; title: string }) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Is this thesis defensible?"
              maxLength={200}
            />
          </div>
          <div className="min-w-0 md:col-span-2">
            <Label>Prompt</Label>
            <Textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={1000}
              placeholder="Frame the debate…"
            />
          </div>

          <div className="min-w-0 md:col-span-2">
            <Label>Who can join</Label>
            <Select
              value={accessMode}
              onValueChange={(v) => setAccessMode(v as AccessMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ACCESS_LABEL) as AccessMode[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {ACCESS_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {accessMode === "tier" && (
            <div className="min-w-0 md:col-span-2">
              <Label>Required tier</Label>
              <Select value={requiredTierId} onValueChange={setRequiredTierId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      tiers.length ? "Pick a tier" : "Create a tier first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {tiers.map(
                    (t: { id: string; name: string; price_cents: number }) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} · ₹{Math.round(t.price_cents / 100)}/mo
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {accessMode === "org" && (
            <div className="min-w-0 md:col-span-2">
              <Label>Organization</Label>
              <Select
                value={orgId || "empty"}
                onValueChange={(v) => setOrgId(v === "empty" ? "" : v)}
              >
                <SelectTrigger className="h-10 w-full rounded border border-border bg-background px-3 text-sm">
                  <SelectValue placeholder="— choose org —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="empty">— choose org —</SelectItem>
                  {(oq.data ?? []).map(
                    (o: {
                      role: string
                      org: { id: string; name: string } | null
                    }) => {
                      if (!o.org) return null
                      return (
                        <SelectItem key={o.org.id} value={o.org.id}>
                          {o.org.name}
                        </SelectItem>
                      )
                    }
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {accessMode === "invite" && (
            <div className="min-w-0 space-y-3 md:col-span-2">
              <Label>Invite people from your follows</Label>
              <Input
                value={inviteQuery}
                onChange={(e) => setInviteQuery(e.target.value)}
                placeholder="Search handle or name…"
              />
              <div className="surface max-h-48 divide-y divide-border overflow-auto rounded-md">
                {inviteResults.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                    {inviteQuery
                      ? "No matches in your follows"
                      : "Start typing or browse — only people you follow or who follow you appear."}
                  </p>
                )}
                {inviteResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => addInvitee(u)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent/40"
                  >
                    <span className="font-medium text-foreground">
                      {u.display_name}
                    </span>{" "}
                    <span className="text-muted-foreground">@{u.handle}</span>
                  </button>
                ))}
              </div>
              {invitees.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {invitees.map((u) => (
                    <Badge key={u.id} variant="secondary" className="gap-1.5">
                      @{u.handle}
                      <button
                        type="button"
                        onClick={() => removeInvitee(u.id)}
                        aria-label="Remove"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="min-w-0 md:col-span-2">
            <Button type="submit">Create room</Button>
          </div>
        </form>
      )}

      <div className="surface divide-y divide-border rounded-md">
        {rooms.map((r: Room) => (
          <div
            key={r.id}
            className="flex items-start justify-between gap-4 px-5 py-4"
          >
            <div>
              <p className="font-display text-foreground">{r.title}</p>
              {r.prompt && (
                <p className="mt-1 text-sm text-muted-foreground">{r.prompt}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {r.access_mode === "public" && "Public"}
                {r.access_mode === "members" && "Members only"}
                {r.access_mode === "tier" &&
                  `Tier: ${tiers.find((t: { id: string; name: string }) => t.id === r.required_tier_id)?.name ?? "—"}`}
                {r.access_mode === "invite" && "Invite-only"}
                {" · "}
                {new Date(r.created_at).toLocaleDateString()}
              </p>
            </div>
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm">
                  Delete
                </Button>
              }
              title="Delete this debate room?"
              description="All messages in the room will be permanently removed."
              destructive
              confirmLabel="Delete room"
              onConfirm={() => remove(r.id)}
            />
          </div>
        ))}
        {pieceId && rooms.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No rooms yet for this piece.
          </p>
        )}
        {!pieceId && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Pick a piece to manage its debate rooms.
          </p>
        )}
      </div>
    </div>
  )
}

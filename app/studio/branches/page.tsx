 
"use client"

import { useQuery } from "@tanstack/react-query"
import {
  listMyBranches,
  createBranch,
  deleteBranch,
  updateBranch,
} from "@/actions/content"
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
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Pencil, Check, X, Plus, Trash2, CheckSquare, Square } from "lucide-react"
import { BranchItem, PieceItem } from "@/lib/types/content"
import { BRANCH_TYPES, VISIBILITY_LEVELS } from "@/lib/content/studio/data"
import type { BranchType, VisibilityLevel } from "@/lib/content/studio/data"

export default function BranchesPage() {
  const listFn = listMyBranches
  const createFn = createBranch
  const delFn = deleteBranch
  const updFn = updateBranch
  const q = useQuery({ queryKey: ["my-branches"], queryFn: () => listFn() })

  const [parent, setParent] = useState("")
  const [type, setType] = useState<BranchType>("teaching")
  const [purpose, setPurpose] = useState("")
  const [visibility, setVisibility] = useState<VisibilityLevel>("public")
  const [summary, setSummary] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [edit, setEdit] = useState<{
    purpose: string
    summary: string
    visibility: VisibilityLevel
  }>({ purpose: "", summary: "", visibility: "public" })

  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const toggleAll = () => {
    const branchList = q.data?.branches ?? []
    if (selected.size === branchList.length) setSelected(new Set())
    else setSelected(new Set(branchList.map((b: BranchItem) => b.id)))
  }

  const bulkArchive = async () => {
    try {
      await Promise.all(
        [...selected].map((id) => updFn({ data: { id, state: "archived" } }))
      )
      toast.success("Archived")
      setSelected(new Set())
      q.refetch()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const bulkDelete = async () => {
    try {
      await Promise.all([...selected].map((id) => delFn({ data: { id } })))
      toast.success("Deleted")
      setSelected(new Set())
      q.refetch()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const submit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!parent) return toast.error("Pick a parent piece")
    try {
      await createFn({
        data: {
          parent_object_id: parent,
          branch_type: type,
          purpose: purpose || undefined,
          visibility,
          summary: summary || undefined,
        },
      })
      toast.success("Branch created")
      setPurpose("")
      setSummary("")
      q.refetch()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const startEdit = (b: {
    id: string
    purpose: string | null
    summary: string | null
    visibility: string
  }) => {
    setEditing(b.id)
    setEdit({
      purpose: b.purpose ?? "",
      summary: b.summary ?? "",
      visibility: (b.visibility as VisibilityLevel) ?? "public",
    })
  }
  const saveEdit = async (id: string) => {
    try {
      await updFn({
        data: {
          id,
          purpose: edit.purpose || null,
          summary: edit.summary || null,
          visibility: edit.visibility,
        },
      })
      toast.success("Branch updated")
      setEditing(null)
      q.refetch()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  const remove = async (id: string) => {
    try {
      await delFn({ data: { id } })
      toast.success("Deleted")
      q.refetch()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const pieceById = new Map<string, PieceItem>(
    (q.data?.pieces ?? []).map((p: PieceItem) => [p.id, p])
  )

  return (
    <div className="mx-auto w-full max-w-350 p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Branches
          </p>
          <h1 className="font-display text-3xl text-foreground">
            Alternate framings
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
                <Plus className="mr-2 size-4" /> Create branch
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
        <div className="min-w-0 md:col-span-2">
          <Label>Parent piece</Label>
          <Select
            value={parent || "empty"}
            onValueChange={(v) => setParent(v === "empty" ? "" : v)}
          >
            <SelectTrigger className="h-10 w-full rounded border border-border bg-background px-3 text-sm">
              <SelectValue placeholder="— choose —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="empty">— choose —</SelectItem>
              {(q.data?.pieces ?? []).map((p: PieceItem) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <Label>Branch type</Label>
          <Select value={type} onValueChange={(v) => setType(v as BranchType)}>
            <SelectTrigger className="h-10 w-full rounded border border-border bg-background px-3 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BRANCH_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <Label>Visibility</Label>
          <Select
            value={visibility}
            onValueChange={(v) => setVisibility(v as VisibilityLevel)}
          >
            <SelectTrigger className="h-10 w-full rounded border border-border bg-background px-3 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISIBILITY_LEVELS.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 md:col-span-2">
          <Label>Purpose</Label>
          <Input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. For beginners"
          />
        </div>
        <div className="md:col-span-2 min-w-0">
          <Label>Summary</Label>
          <Textarea
            rows={2}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="A brief summary of this branch"
          />
        </div>
        <div className="md:col-span-2 flex gap-2">
          <Button type="submit">Create branch</Button>
          <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
        </div>
      </form>
      )}

      {selected.size > 0 && (
        <div className="surface-elevated mb-4 flex items-center gap-3 rounded-md p-3">
          <span className="text-sm text-muted-foreground">
            {selected.size} selected
          </span>
          <Button size="sm" variant="outline" onClick={bulkArchive}>
            Archive
          </Button>
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="outline">
                <Trash2 className="mr-1 size-3" /> Delete
              </Button>
            }
            title={`Delete ${selected.size} branch${selected.size > 1 ? "es" : ""}?`}
            description="This cannot be undone."
            destructive
            confirmLabel="Delete"
            onConfirm={bulkDelete}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      <div className="surface divide-y divide-border rounded-md">
        {/* Select all */}
        {(q.data?.branches ?? []).length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
            <button
              onClick={toggleAll}
              className="text-muted-foreground hover:text-foreground"
              title={
                selected.size === (q.data?.branches ?? []).length
                  ? "Deselect all"
                  : "Select all"
              }
            >
              {selected.size === (q.data?.branches ?? []).length ? (
                <CheckSquare className="size-4" />
              ) : (
                <Square className="size-4" />
              )}
            </button>
            <span className="text-xs text-muted-foreground">
              {(q.data?.branches ?? []).length} branch{(q.data?.branches ?? []).length !== 1 ? "es" : ""}
            </span>
          </div>
        )}

        {(q.data?.branches ?? []).map((b: BranchItem) => {
          const parent = pieceById.get(b.parent_object_id)
          const isEditing = editing === b.id
          return (
            <div key={b.id} className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-accent/30">
              <button
                onClick={() => toggleSelect(b.id)}
                className="mt-1 shrink-0 text-muted-foreground hover:text-foreground"
              >
                {selected.has(b.id) ? (
                  <CheckSquare className="size-4 text-primary" />
                ) : (
                  <Square className="size-4" />
                )}
              </button>
              <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-foreground">{parent?.title ?? "—"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {b.branch_type} · {b.visibility} · {b.state}
                  </p>
                  {!isEditing && b.purpose && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {b.purpose}
                    </p>
                  )}
                  {!isEditing && b.summary && (
                    <p className="mt-1 text-sm text-muted-foreground/80">
                      {b.summary}
                    </p>
                  )}
                  {isEditing && (
                    <div className="mt-3 space-y-2">
                      <Input
                        value={edit.purpose}
                        onChange={(e) =>
                          setEdit({ ...edit, purpose: e.target.value })
                        }
                        placeholder="Purpose"
                      />
                      <Textarea
                        rows={2}
                        value={edit.summary}
                        onChange={(e) =>
                          setEdit({ ...edit, summary: e.target.value })
                        }
                        placeholder="Summary"
                      />
                      <Select
                        value={edit.visibility}
                        onValueChange={(v) =>
                          setEdit({
                            ...edit,
                            visibility: v as VisibilityLevel,
                          })
                        }
                      >
                        <SelectTrigger className="h-9 rounded border border-border bg-background px-2 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VISIBILITY_LEVELS.map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  {isEditing ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => saveEdit(b.id)}
                      >
                        <Check className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(null)}
                      >
                        <X className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(b)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="sm">
                            Delete
                          </Button>
                        }
                        title="Delete this branch?"
                        description="The branch and any debate rooms attached to it will be removed."
                        destructive
                        confirmLabel="Delete branch"
                        onConfirm={() => remove(b.id)}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {(q.data?.branches ?? []).length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No branches yet.
          </p>
        )}
      </div>
    </div>
  )
}

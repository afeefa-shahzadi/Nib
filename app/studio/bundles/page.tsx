/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useQuery } from "@tanstack/react-query"
import {
  listMyBundles,
  createBundle,
  deleteBundle,
  updateBundle,
  listMyPieces,
  listBundleItems,
  addBundleItem,
  removeBundleItem,
  reorderBundleItems,
} from "@/actions/content"
import { suggestBundleCuration } from "@/actions/ai"
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
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { BundleItem } from "@/lib/types/content"
import { Pencil, X, Plus, GripVertical, Lock, Sparkles, Loader2 } from "lucide-react"
import { useMyPlan } from "@/hooks/use-my-plan"
import { hasStudioAccess } from "@/lib/plan"
import Link from "next/link"

export default function BundlesPage() {
  const listFn = listMyBundles
  const createFn = createBundle
  const delFn = deleteBundle
  const updFn = updateBundle
  const piecesFn = listMyPieces
  const itemsFn = listBundleItems
  const addItemFn = addBundleItem
  const rmItemFn = removeBundleItem
  const reorderFn = reorderBundleItems

  const q = useQuery({ queryKey: ["my-bundles"], queryFn: () => listFn() })
  const pq = useQuery({ queryKey: ["my-pieces"], queryFn: () => piecesFn() })

  const [mounted, setMounted] = useState(false)
  useEffect(() => queueMicrotask(() => setMounted(true)), [])

  const { plan, loading: planLoading } = useMyPlan()
  const hasStudio = hasStudioAccess(plan)

  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState("")
  const [desc, setDesc] = useState("")
  const [outcome, setOutcome] = useState("")
  const [price, setPrice] = useState("0")
  const [isPublic, setIsPublic] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  const [showAutoCurate, setShowAutoCurate] = useState(false)
  const [topic, setTopic] = useState("")
  const [isCurating, setIsCurating] = useState(false)
  const [pendingPieces, setPendingPieces] = useState<{id: string, title: string}[]>([])

  const handleCurate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic) return
    setIsCurating(true)
    try {
      const res = await suggestBundleCuration({ data: { topic } })
      if (res && res.suggestedTitle) {
        setTitle(res.suggestedTitle)
        setPendingPieces(res.suggestedPieces || [])
        setShowAutoCurate(false)
        setShowCreate(true)
        toast.success("AI curating complete! Review the bundle.")
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsCurating(false)
    }
  }

  const submit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      const res = await createFn({
        data: {
          title,
          description: desc || undefined,
          outcome: outcome || undefined,
          price_cents: Math.max(0, Math.floor(Number(price) * 100) || 0),
          is_public: isPublic,
        },
      })
      
      if (res.bundleId && pendingPieces.length > 0) {
        // Add pending pieces to the new bundle
        for (const p of pendingPieces) {
          await addItemFn({ data: { bundle_id: res.bundleId, content_object_id: p.id } })
        }
      }

      toast.success("Bundle created")
      setShowCreate(false)
      setTitle("")
      setDesc("")
      setOutcome("")
      setPrice("0")
      setPendingPieces([])
      q.refetch()
    } catch (err) {
      toast.error((err as Error).message)
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

  if (!mounted || planLoading) {
    return (
      <div className="mx-auto w-full max-w-350 p-6 md:p-8">
        <div className="h-32 w-full animate-pulse rounded-md bg-muted/20" />
      </div>
    )
  }

  if (!hasStudio) {
    return (
      <div className="mx-auto w-full max-w-350 p-6 md:p-8">
        <div className="surface-elevated mt-12 flex flex-col items-center justify-center gap-4 rounded-md p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="size-6 text-primary" />
          </div>
          <h2 className="font-display text-2xl">Studio plan required</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Bundles and outcome-shaped collections are available on the Studio plan.
          </p>
          <Link href="/pricing">
            <Button className="mt-2">Upgrade to Studio</Button>
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
            Bundles
          </p>
          <h1 className="font-display text-3xl text-foreground">
            Outcome-shaped collections
          </h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAutoCurate(!showAutoCurate)}
            className="border-primary text-primary hover:bg-primary/10"
          >
            {showAutoCurate ? (
              <>
                <X className="mr-2 size-4" /> Cancel AI
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" /> Auto-Curate
              </>
            )}
          </Button>
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
                <Plus className="mr-2 size-4" /> Create bundle
              </>
            )}
          </Button>
        </div>
      </div>

      {showAutoCurate && (
        <form
          onSubmit={handleCurate}
          className="surface mb-10 flex flex-col items-start gap-4 rounded-md border border-border/60 p-6 md:flex-row md:items-end"
        >
          <div className="flex-1 min-w-0 w-full">
            <Label>Topic</Label>
            <Input
              required
              placeholder="e.g. Creator Economy, Open Source AI"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={isCurating}>
            {isCurating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            Curate Bundle
          </Button>
        </form>
      )}

      {showCreate && (
      <form
        onSubmit={submit}
        className="surface mb-10 grid gap-4 rounded-md border border-border/60 p-6 md:grid-cols-2"
      >
        <div className="min-w-0 md:col-span-2">
          <Label>Title</Label>
          <Input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="min-w-0">
          <Label>Price (₹)</Label>
          <Input
            type="number"
            min="0"
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Public
          </label>
        </div>
        <div className="min-w-0 md:col-span-2">
          <Label>Outcome</Label>
          <Input
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="What will a reader be able to do?"
          />
        </div>
        <div className="min-w-0 md:col-span-2">
          <Label>Description</Label>
          <Textarea
            rows={3}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>
        {pendingPieces.length > 0 && (
          <div className="md:col-span-2">
            <Label>AI Curated Pieces</Label>
            <div className="mt-2 flex flex-col gap-2 rounded border border-border bg-background p-3">
              {pendingPieces.map((p, i) => (
                <div key={i} className="text-sm font-medium flex items-center justify-between">
                  <span>{p.title}</span>
                  <button type="button" onClick={() => setPendingPieces(pendingPieces.filter((_, idx) => idx !== i))} className="text-destructive hover:underline text-xs">Remove</button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 md:col-span-2">
          <Button type="submit">Create bundle</Button>
          <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
        </div>
      </form>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(q.data ?? []).map((b: BundleItem) => (
          <BundleCard
            key={b.id}
            bundle={b}
            pieces={pq.data ?? []}
            expanded={openId === b.id}
            onToggle={() => setOpenId(openId === b.id ? null : b.id)}
            onDelete={() => remove(b.id)}
            onUpdate={async (patch) => {
              await updFn({ data: { id: b.id, ...patch } })
              q.refetch()
            }}
            loadItems={() => itemsFn({ data: { bundle_id: b.id } })}
            addItem={async (cid) => {
              await addItemFn({
                data: { bundle_id: b.id, content_object_id: cid },
              })
            }}
            rmItem={async (id) => {
              await rmItemFn({ data: { id } })
            }}
            reorder={async (ids) => {
              await reorderFn({ data: { bundle_id: b.id, ordered_ids: ids } })
            }}
          />
        ))}
        {(q.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No bundles yet.</p>
        )}
      </div>
    </div>
  )
}

interface BundleCardProps {
  bundle: BundleItem
  pieces: { id: string; title: string }[]
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
  onUpdate: (p: {
    title?: string
    description?: string | null
    outcome?: string | null
    price_cents?: number
    is_public?: boolean
  }) => Promise<void>
  loadItems: () => Promise<
    Array<{
      id: string
      content_object_id: string | null
      branch_id: string | null
    }>
  >
  addItem: (cid: string) => Promise<void>
  rmItem: (id: string) => Promise<void>
  reorder: (ordered_ids: string[]) => Promise<void>
}

function BundleCard({
  bundle,
  pieces,
  expanded,
  onToggle,
  onDelete,
  onUpdate,
  loadItems,
  addItem,
  rmItem,
  reorder,
}: BundleCardProps) {
  const [editing, setEditing] = useState(false)
  const [t, setT] = useState(bundle.title)
  const [d, setD] = useState(bundle.description ?? "")
  const [o, setO] = useState((bundle as any as Record<string, unknown>).outcome_statement as string ?? "")
  const [p, setP] = useState(String(((bundle as any as Record<string, unknown>).price as number || 0) / 100))
  // The database row returns 'visibility', map it or default to false
  const [isPub, setIsPub] = useState((bundle as any as Record<string, unknown>).visibility === "public")
  const [items, setItems] = useState<
    Array<{
      id: string
      content_object_id: string | null
      branch_id: string | null
    }>
  >([])
  const [addPiece, setAddPiece] = useState("")
  const dragIdx = useRef<number | null>(null)
  const pieceById = new Map(pieces.map((x) => [x.id, x]))

  useEffect(() => {
    if (expanded) loadItems().then(setItems)
  }, [expanded, loadItems])

  const save = async () => {
    try {
      await onUpdate({
        title: t,
        description: d || null,
        outcome: o || null,
        price_cents: Math.max(0, Math.floor(Number(p) * 100) || 0),
        is_public: isPub,
      })
      toast.success("Updated")
      setEditing(false)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="surface rounded-md p-5">
      {editing ? (
        <div className="space-y-2">
          <Input value={t} onChange={(e) => setT(e.target.value)} />
          <Input
            value={o}
            onChange={(e) => setO(e.target.value)}
            placeholder="Outcome"
          />
          <Textarea rows={2} value={d} onChange={(e) => setD(e.target.value)} />
          <Input
            type="number"
            min="0"
            value={p}
            onChange={(e) => setP(e.target.value)}
          />
          <div className="flex items-center gap-2 mb-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={isPub}
                onChange={(e) => setIsPub(e.target.checked)}
              />
              Public
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save}>
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-lg text-foreground">
              {bundle.title}
            </h3>
            <span className="text-xs text-muted-foreground">
              ₹{(((bundle as any as Record<string, unknown>).price as number) / 100 || 0).toFixed(0)}
            </span>
          </div>
          {(bundle as any as Record<string, unknown>).outcome_statement && (
            <p className="mt-1 text-sm text-primary">{(bundle as any as Record<string, unknown>).outcome_statement as string}</p>
          )}
          {bundle.description && (
            <p className="mt-2 text-sm text-muted-foreground">
              {bundle.description}
            </p>
          )}
          <p className="mt-3 text-xs tracking-wider text-muted-foreground uppercase">
            {(bundle as any as Record<string, unknown>).visibility === "public" ? "Public" : "Private"}
          </p>
          <div className="mt-3 flex gap-1">
            <Button variant="ghost" size="sm" onClick={onToggle}>
              {expanded ? "Hide items" : "Manage items"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-4" />
            </Button>
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm">
                  Delete
                </Button>
              }
              title="Delete this bundle?"
              description="The bundle and its item list will be removed. Purchases stay in your records."
              destructive
              confirmLabel="Delete bundle"
              onConfirm={onDelete}
            />
          </div>
        </>
      )}

      {expanded && (
        <div className="hairline-t mt-4 space-y-2 pt-4">
          <p className="text-xs tracking-wider text-muted-foreground uppercase">
            Items · drag to reorder
          </p>
          {items.map((it, idx) => (
            <div
              key={it.id}
              draggable
              onDragStart={() => {
                dragIdx.current = idx
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async () => {
                const from = dragIdx.current
                dragIdx.current = null
                if (from == null || from === idx) return
                const copy = [...items]
                const [m] = copy.splice(from, 1)
                copy.splice(idx, 0, m)
                setItems(copy)
                try {
                  await reorder(copy.map((x) => x.id))
                } catch (e) {
                  toast.error((e as Error).message)
                  loadItems().then(setItems)
                }
              }}
              className="flex cursor-grab items-center justify-between gap-2 rounded border border-transparent bg-card/40 px-2 py-1 text-sm hover:border-border active:cursor-grabbing"
            >
              <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">
                {pieceById.get(it.content_object_id ?? "")?.title ?? "—"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  await rmItem(it.id)
                  setItems((s) => s.filter((x) => x.id !== it.id))
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground">No items yet.</p>
          )}
          <div className="flex gap-2 pt-2">
            <Select
              value={addPiece || "empty"}
              onValueChange={(v) => setAddPiece(v === "empty" ? "" : v)}
            >
              <SelectTrigger className="h-9 flex-1 rounded border border-border bg-background px-2 text-sm">
                <SelectValue placeholder="— add a piece —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="empty">— add a piece —</SelectItem>
                {pieces.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!addPiece}
              onClick={async () => {
                try {
                  await addItem(addPiece)
                  const x = await loadItems()
                  setItems(x)
                  setAddPiece("")
                  toast.success("Added")
                } catch (e) {
                  toast.error((e as Error).message)
                }
              }}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

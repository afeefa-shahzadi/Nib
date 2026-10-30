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
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { BundleItem } from "@/lib/types/content"
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  GripVertical,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { useMyPlan } from "@/hooks/use-my-plan"
import { hasStudioAccess } from "@/lib/plan"
import Link from "next/link"

type Piece = { id: string; title: string }
type Item = {
  id: string
  content_object_id: string | null
  branch_id: string | null
  piece?: { title: string } | null
}
// What the New dialog starts with: blank, or filled in by the AI suggestion.
type Draft = { title: string; pieces: Piece[] }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
const priceLabel = (paise: number) =>
  paise > 0 ? `₹${(paise / 100).toLocaleString("en-IN")}` : "Free"

export default function BundlesPage() {
  const q = useQuery({ queryKey: ["my-bundles"], queryFn: () => listMyBundles() })
  const pq = useQuery({ queryKey: ["my-pieces"], queryFn: () => listMyPieces() })

  const [mounted, setMounted] = useState(false)
  useEffect(() => queueMicrotask(() => setMounted(true)), [])

  const { plan, loading: planLoading } = useMyPlan()
  const hasStudio = hasStudioAccess(plan)

  // null = closed; a Draft = new bundle; a BundleItem = editing that bundle
  const [editing, setEditing] = useState<BundleItem | Draft | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  if (!mounted || planLoading || (hasStudio && q.isPending)) {
    return (
      <div className="mx-auto w-full max-w-350 px-4 py-6 sm:px-6 md:px-8 md:py-8">
        <Skeleton className="mb-6 h-16 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-56 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!hasStudio) {
    return (
      <div className="mx-auto w-full max-w-350 px-4 py-6 sm:px-6 md:px-8 md:py-8">
        <div className="surface-elevated mt-12 flex flex-col items-center justify-center gap-4 rounded-lg p-8 text-center sm:p-12">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="size-6 text-primary" aria-hidden />
          </div>
          <h2 className="font-display text-2xl">Studio plan required</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Bundles and outcome-shaped collections are available on the Studio plan.
          </p>
          <Button asChild className="mt-2 min-h-11">
            <Link href="/pricing">Upgrade to Studio</Link>
          </Button>
        </div>
      </div>
    )
  }

  const bundles = (q.data ?? []) as BundleItem[]
  const pieces = (pq.data ?? []) as Piece[]
  const startNew = () => setEditing({ title: "", pieces: [] })

  return (
    <div className="mx-auto w-full max-w-350 px-4 py-6 sm:px-6 md:px-8 md:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-foreground">Bundles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Group pieces around one outcome and sell them together.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="min-h-11" onClick={() => setSuggesting(true)}>
            <Sparkles className="size-4" aria-hidden /> Suggest with AI
          </Button>
          {bundles.length > 0 && (
            <Button className="min-h-11" onClick={startNew}>
              <Plus className="size-4" aria-hidden /> New bundle
            </Button>
          )}
        </div>
      </div>

      {q.isError ? (
        <div className="surface rounded-lg p-6 text-center">
          <p className="font-medium text-foreground">Couldn&apos;t load your bundles</p>
          <Button variant="outline" className="mt-4 min-h-11" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      ) : bundles.length === 0 ? (
        <div className="surface flex flex-col items-center gap-2 rounded-lg p-8 text-center sm:p-12">
          <h2 className="font-display text-xl text-foreground">Create your first bundle</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            A bundle is a set of pieces that gets a reader to one outcome, sold or
            given away as a whole.
          </p>
          <Button className="mt-4 min-h-11" onClick={startNew}>
            <Plus className="size-4" aria-hidden /> New bundle
          </Button>
        </div>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {bundles.map((b) => (
            <BundleCard
              key={b.id}
              bundle={b}
              pieces={pieces}
              expanded={openId === b.id}
              onToggle={() => setOpenId(openId === b.id ? null : b.id)}
              onEdit={() => setEditing(b)}
              onChanged={() => q.refetch()}
              onDelete={async () => {
                try {
                  await deleteBundle({ data: { id: b.id } })
                  toast.success("Bundle deleted.")
                  q.refetch()
                } catch (e) {
                  toast.error((e as Error).message)
                }
              }}
            />
          ))}
        </div>
      )}

      <SuggestDialog
        open={suggesting}
        onClose={() => setSuggesting(false)}
        onSuggested={(draft) => {
          setSuggesting(false)
          setEditing(draft)
        }}
      />

      <BundleDialog
        key={editing === null ? "closed" : "id" in editing ? editing.id : "new"}
        bundle={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          q.refetch()
        }}
      />
    </div>
  )
}

function SuggestDialog({
  open,
  onClose,
  onSuggested,
}: {
  open: boolean
  onClose: () => void
  onSuggested: (d: Draft) => void
}) {
  const [topic, setTopic] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) return setError("Enter a topic.")
    setError("")
    setBusy(true)
    try {
      const res = await suggestBundleCuration({ data: { topic: topic.trim() } })
      if (!res?.suggestedTitle) throw new Error("No suggestion came back. Try another topic.")
      setTopic("")
      onSuggested({ title: res.suggestedTitle, pieces: res.suggestedPieces ?? [] })
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Suggest a bundle</DialogTitle>
            <DialogDescription>
              Name a topic and AI picks a title and pieces from your work. You review
              it before anything is saved.
            </DialogDescription>
          </DialogHeader>
          <div className="my-6">
            <Label htmlFor="suggest-topic">Topic</Label>
            <Input
              id="suggest-topic"
              className="mt-2 min-h-11"
              placeholder="Creator economy, open source AI"
              value={topic}
              aria-invalid={!!error}
              aria-describedby={error ? "suggest-topic-error" : undefined}
              onChange={(e) => setTopic(e.target.value)}
            />
            {error && (
              <p id="suggest-topic-error" className="mt-1 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11" disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
              {busy ? "Suggesting…" : "Suggest"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function BundleDialog({
  bundle,
  onClose,
  onSaved,
}: {
  bundle: BundleItem | Draft | null
  onClose: () => void
  onSaved: () => void
}) {
  const existing = bundle && "id" in bundle ? bundle : null
  const [title, setTitle] = useState(bundle?.title ?? "")
  const [outcome, setOutcome] = useState(existing?.outcome_statement ?? "")
  const [desc, setDesc] = useState(existing?.description ?? "")
  const [price, setPrice] = useState(existing ? String(existing.price / 100) : "0")
  const [isPublic, setIsPublic] = useState(existing ? existing.visibility === "public" : true)
  const [pending, setPending] = useState<Piece[]>(bundle && !existing ? (bundle as Draft).pieces : [])
  const [errors, setErrors] = useState<{ title?: string; price?: string }>({})
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const found: typeof errors = {}
    if (!title.trim()) found.title = "Give the bundle a title."
    const rupees = Number(price)
    if (price.trim() === "" || !Number.isFinite(rupees) || rupees < 0)
      found.price = "Enter a price of ₹0 or more."
    else if (!Number.isInteger(rupees)) found.price = "Use whole rupees, like 199."
    setErrors(found)
    if (Object.keys(found).length) return

    const data = {
      title: title.trim(),
      description: desc.trim() || null,
      outcome: outcome.trim() || null,
      price_cents: rupees * 100,
      is_public: isPublic,
    }
    setBusy(true)
    try {
      if (existing) {
        await updateBundle({ data: { id: existing.id, ...data } })
        toast.success("Bundle saved.")
      } else {
        const res = await createBundle({
          data: { ...data, description: data.description ?? undefined, outcome: data.outcome ?? undefined },
        })
        for (const p of pending)
          await addBundleItem({ data: { bundle_id: res.bundleId, content_object_id: p.id } })
        toast.success("Bundle created.")
      }
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const err = (k: keyof typeof errors) =>
    errors[k] && (
      <p id={`bundle-${k}-error`} className="mt-1 text-sm text-destructive">
        {errors[k]}
      </p>
    )

  return (
    <Dialog open={bundle !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{existing ? "Edit bundle" : "New bundle"}</DialogTitle>
            <DialogDescription>
              Readers see the title, outcome and price on the bundle&apos;s page.
            </DialogDescription>
          </DialogHeader>

          <div className="my-6 space-y-4">
            <div>
              <Label htmlFor="bundle-title">Title</Label>
              <Input
                id="bundle-title"
                className="mt-2 min-h-11"
                placeholder="Writing your first essay"
                value={title}
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? "bundle-title-error" : undefined}
                onChange={(e) => setTitle(e.target.value)}
              />
              {err("title")}
            </div>
            <div>
              <Label htmlFor="bundle-outcome">Outcome</Label>
              <Input
                id="bundle-outcome"
                className="mt-2 min-h-11"
                placeholder="What will a reader be able to do?"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="bundle-description">Description</Label>
              <Textarea
                id="bundle-description"
                className="mt-2"
                rows={3}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="bundle-price">Price (₹)</Label>
                <Input
                  id="bundle-price"
                  className="mt-2 min-h-11"
                  inputMode="numeric"
                  value={price}
                  aria-invalid={!!errors.price}
                  aria-describedby={errors.price ? "bundle-price-error" : "bundle-price-hint"}
                  onChange={(e) => setPrice(e.target.value)}
                />
                {err("price") || (
                  <p id="bundle-price-hint" className="mt-1 text-sm text-muted-foreground">
                    ₹0 makes it free.
                  </p>
                )}
              </div>
              <div className="flex min-h-11 items-center justify-between gap-4 sm:mt-7">
                <Label htmlFor="bundle-public" className="flex-1">
                  Public
                  <span className="block text-sm font-normal text-muted-foreground">
                    Shown on your profile
                  </span>
                </Label>
                <Switch id="bundle-public" checked={isPublic} onCheckedChange={setIsPublic} />
              </div>
            </div>
            {pending.length > 0 && (
              <div>
                <p className="text-sm font-medium">Suggested pieces</p>
                <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                  {pending.map((p, i) => (
                    <li key={p.id} className="flex items-center gap-2 pl-3">
                      <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11 shrink-0"
                        aria-label={`Remove ${p.title}`}
                        onClick={() => setPending(pending.filter((_, idx) => idx !== i))}
                      >
                        <X className="size-4" aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11" disabled={busy}>
              {busy ? "Saving…" : existing ? "Save bundle" : "Create bundle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function BundleCard({
  bundle,
  pieces,
  expanded,
  onToggle,
  onEdit,
  onChanged,
  onDelete,
}: {
  bundle: BundleItem
  pieces: Piece[]
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onChanged: () => void
  onDelete: () => Promise<void>
}) {
  const isPublic = bundle.visibility === "public"
  return (
    <div className="surface flex min-w-0 flex-col rounded-lg p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="min-w-0 font-display text-xl break-words text-foreground">
          {bundle.title}
        </h2>
        <span className="shrink-0 font-display text-xl text-primary">
          {priceLabel(bundle.price)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={isPublic ? "secondary" : "outline"}>{isPublic ? "Public" : "Private"}</Badge>
        <span>{plural(bundle.item_count, "piece")}</span>
      </div>
      {bundle.outcome_statement && (
        <p className="mt-4 text-sm break-words text-foreground">{bundle.outcome_statement}</p>
      )}
      {bundle.description && (
        <p className="mt-2 text-sm break-words text-muted-foreground">{bundle.description}</p>
      )}

      <div className="hairline-t mt-4 flex flex-wrap gap-2 pt-2">
        <Button variant="ghost" className="min-h-11" aria-expanded={expanded} onClick={onToggle}>
          {expanded ? "Done" : "Manage pieces"}
        </Button>
        <Button variant="ghost" className="min-h-11" onClick={onEdit}>
          <Pencil className="size-4" aria-hidden /> Edit
        </Button>
        {isPublic && bundle.handle && (
          <Button asChild variant="ghost" className="min-h-11">
            <Link href={`/u/${bundle.handle}/bundles/${bundle.id}`} target="_blank">
              <ExternalLink className="size-4" aria-hidden /> View page
            </Link>
          </Button>
        )}
        <ConfirmDialog
          trigger={
            <Button variant="ghost" className="min-h-11 text-destructive hover:text-destructive">
              <Trash2 className="size-4" aria-hidden /> Delete
            </Button>
          }
          title="Delete this bundle?"
          description="The bundle and its piece list will be removed. Purchases stay in your records."
          destructive
          confirmLabel="Delete bundle"
          onConfirm={onDelete}
        />
      </div>

      {expanded && <BundlePieces bundleId={bundle.id} pieces={pieces} onChanged={onChanged} />}
    </div>
  )
}

function BundlePieces({
  bundleId,
  pieces,
  onChanged,
}: {
  bundleId: string
  pieces: Piece[]
  onChanged: () => void
}) {
  const iq = useQuery({
    queryKey: ["bundle-items", bundleId],
    queryFn: () => listBundleItems({ data: { bundle_id: bundleId } }) as Promise<Item[]>,
  })
  const [items, setItems] = useState<Item[] | null>(null)
  const list = items ?? iq.data ?? []
  const dragIdx = useRef<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const titleOf = (it: Item) =>
    it.piece?.title ?? pieces.find((p) => p.id === it.content_object_id)?.title ?? "Untitled piece"
  const inBundle = new Set(list.map((it) => it.content_object_id))
  const addable = pieces.filter((p) => !inBundle.has(p.id))

  const refresh = async () => {
    setItems(null)
    await iq.refetch()
    onChanged()
  }

  const move = async (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return
    const copy = [...list]
    const [m] = copy.splice(from, 1)
    copy.splice(to, 0, m)
    setItems(copy)
    try {
      await reorderBundleItems({ data: { bundle_id: bundleId, ordered_ids: copy.map((x) => x.id) } })
    } catch (e) {
      toast.error((e as Error).message)
      refresh()
    }
  }

  const add = async (p: Piece) => {
    setPickerOpen(false)
    try {
      await addBundleItem({ data: { bundle_id: bundleId, content_object_id: p.id } })
      toast.success(`Added ${p.title}.`)
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const remove = async (it: Item) => {
    try {
      await removeBundleItem({ data: { id: it.id } })
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="hairline-t mt-2 pt-4">
      <p className="text-sm text-muted-foreground">
        Readers go through pieces in this order. Use the arrows or drag to reorder.
      </p>
      {iq.isPending ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
      ) : iq.isError ? (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-destructive">Couldn&apos;t load the pieces.</span>
          <Button variant="ghost" className="min-h-11" onClick={() => iq.refetch()}>
            Try again
          </Button>
        </div>
      ) : list.length === 0 ? (
        <p className="mt-3 text-sm text-foreground">No pieces yet. Add the first one below.</p>
      ) : (
        <ol className="mt-3 divide-y divide-border rounded-md border border-border">
          {list.map((it, idx) => (
            <li
              key={it.id}
              draggable
              onDragStart={() => (dragIdx.current = idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const from = dragIdx.current
                dragIdx.current = null
                if (from != null) move(from, idx)
              }}
              className="flex items-center gap-1 pl-2"
            >
              <GripVertical
                className="hidden size-4 shrink-0 cursor-grab text-muted-foreground sm:block"
                aria-hidden
              />
              <span className="w-6 shrink-0 text-center text-sm text-muted-foreground tabular-nums">
                {idx + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{titleOf(it)}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label={`Move ${titleOf(it)} up`}
                disabled={idx === 0}
                onClick={() => move(idx, idx - 1)}
              >
                <ArrowUp className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label={`Move ${titleOf(it)} down`}
                disabled={idx === list.length - 1}
                onClick={() => move(idx, idx + 1)}
              >
                <ArrowDown className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label={`Remove ${titleOf(it)}`}
                onClick={() => remove(it)}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      )}

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="mt-3 min-h-11 w-full sm:w-auto" disabled={addable.length === 0}>
            <Plus className="size-4" aria-hidden />
            {pieces.length === 0 ? "Write a piece to add it" : addable.length === 0 ? "All your pieces are in" : "Add a piece"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(24rem,calc(100vw-2rem))] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search your pieces" className="min-h-11" />
            <CommandList>
              <CommandEmpty>No pieces by that name.</CommandEmpty>
              {addable.map((p) => (
                <CommandItem key={p.id} value={`${p.title} ${p.id}`} className="min-h-11" onSelect={() => add(p)}>
                  <span className="truncate">{p.title}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

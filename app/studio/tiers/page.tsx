"use client"

import { useQuery } from "@tanstack/react-query"
import {
  listMyTiers,
  createTier,
  updateTier,
  deleteTier,
} from "@/actions/content"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Check, Lock, Pencil, Plus, Trash2, Users } from "lucide-react"
import { AuthorTierItem } from "@/lib/types/content"
import { useMyPlan } from "@/hooks/use-my-plan"
import { hasStudioAccess } from "@/lib/plan"
import Link from "next/link"

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

export default function TiersPage() {
  const q = useQuery({ queryKey: ["my-tiers"], queryFn: () => listMyTiers() })

  const [mounted, setMounted] = useState(false)
  useEffect(() => queueMicrotask(() => setMounted(true)), [])

  const { plan, loading: planLoading } = useMyPlan()
  const hasStudio = hasStudioAccess(plan)

  // null = closed, "new" = create, otherwise the tier being edited
  const [editing, setEditing] = useState<AuthorTierItem | "new" | null>(null)

  if (!mounted || planLoading || (hasStudio && q.isPending)) {
    return (
      <div className="mx-auto w-full max-w-350 px-4 py-6 sm:px-6 md:px-8 md:py-8">
        <Skeleton className="mb-6 h-16 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
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
            Membership tiers and subscriptions are available on the Studio plan.
          </p>
          <Button asChild className="mt-2 min-h-11">
            <Link href="/pricing">Upgrade to Studio</Link>
          </Button>
        </div>
      </div>
    )
  }

  const tiers = q.data ?? []
  const supporters = tiers.reduce((n, t) => n + t.supporters, 0)

  return (
    <div className="mx-auto w-full max-w-350 px-4 py-6 sm:px-6 md:px-8 md:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-foreground">Tiers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What supporters pay you each month.{" "}
            {plural(supporters, "active supporter")} across all tiers.
          </p>
        </div>
        {tiers.length > 0 && (
          <Button className="min-h-11" onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden /> New tier
          </Button>
        )}
      </div>

      {q.isError ? (
        <div className="surface rounded-lg p-6 text-center">
          <p className="font-medium text-foreground">
            Couldn&apos;t load your tiers
          </p>
          <Button
            variant="outline"
            className="mt-4 min-h-11"
            onClick={() => q.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : tiers.length === 0 ? (
        <div className="surface flex flex-col items-center gap-2 rounded-lg p-8 text-center sm:p-12">
          <h2 className="font-display text-xl text-foreground">
            Create your first tier
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            A tier is a monthly membership readers can join to support you.
          </p>
          <Button className="mt-4 min-h-11" onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden /> New tier
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tiers.map((t) => (
            <TierCard
              key={t.id}
              tier={t}
              onEdit={() => setEditing(t)}
              onDelete={async () => {
                try {
                  await deleteTier({ data: { id: t.id } })
                  toast.success("Tier deleted.")
                  q.refetch()
                } catch (e) {
                  toast.error((e as Error).message)
                }
              }}
            />
          ))}
        </div>
      )}

      <TierDialog
        key={
          editing === null ? "closed" : editing === "new" ? "new" : editing.id
        }
        tier={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          q.refetch()
        }}
      />
    </div>
  )
}

function TierDialog({
  tier,
  onClose,
  onSaved,
}: {
  tier: AuthorTierItem | "new" | null
  onClose: () => void
  onSaved: () => void
}) {
  const existing = tier && tier !== "new" ? tier : null
  const [name, setName] = useState(existing?.name ?? "")
  const [price, setPrice] = useState(
    existing ? String(existing.price_cents / 100) : "99"
  )
  const [description, setDescription] = useState(existing?.description ?? "")
  const [perksText, setPerksText] = useState((existing?.perks ?? []).join("\n"))
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({})
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const found: typeof errors = {}
    if (!name.trim()) found.name = "Give the tier a name."
    const rupees = Number(price)
    if (price.trim() === "" || !Number.isFinite(rupees) || rupees < 0)
      found.price = "Enter a price of ₹0 or more."
    else if (!Number.isInteger(rupees))
      found.price = "Use whole rupees, like 99."
    setErrors(found)
    if (Object.keys(found).length) return

    const data = {
      name: name.trim(),
      description: description.trim() || null,
      price_cents: rupees * 100,
      perks: perksText
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean),
    }
    setBusy(true)
    try {
      if (existing) {
        await updateTier({ data: { id: existing.id, ...data } })
        toast.success("Tier saved.")
      } else {
        await createTier({ data })
        toast.success("Tier created.")
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
      <p id={`tier-${k}-error`} className="mt-1 text-sm text-destructive">
        {errors[k]}
      </p>
    )

  return (
    <Dialog open={tier !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{existing ? "Edit tier" : "New tier"}</DialogTitle>
            <DialogDescription>
              Readers pick a tier when they join your membership.
            </DialogDescription>
          </DialogHeader>

          <div className="my-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="tier-name">Name</Label>
                <Input
                  id="tier-name"
                  className="mt-2 min-h-11"
                  placeholder="Supporter"
                  value={name}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "tier-name-error" : undefined}
                  onChange={(e) => setName(e.target.value)}
                />
                {err("name")}
              </div>
              <div>
                <Label htmlFor="tier-price">Price per month (₹)</Label>
                <Input
                  id="tier-price"
                  className="mt-2 min-h-11"
                  inputMode="numeric"
                  value={price}
                  aria-invalid={!!errors.price}
                  aria-describedby={
                    errors.price ? "tier-price-error" : "tier-price-hint"
                  }
                  onChange={(e) => setPrice(e.target.value)}
                />
                {err("price") || (
                  <p
                    id="tier-price-hint"
                    className="mt-1 text-sm text-muted-foreground"
                  >
                    ₹0 makes a free tier.
                  </p>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="tier-description">Description</Label>
              <Textarea
                id="tier-description"
                className="mt-2"
                rows={2}
                placeholder="What does this tier promise?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tier-perks">Perks</Label>
              <Textarea
                id="tier-perks"
                className="mt-2"
                rows={4}
                placeholder={"Early access to drafts\nMember-only debates"}
                aria-describedby="tier-perks-hint"
                value={perksText}
                onChange={(e) => setPerksText(e.target.value)}
              />
              <p
                id="tier-perks-hint"
                className="mt-1 text-sm text-muted-foreground"
              >
                One perk per line.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" className="min-h-11" disabled={busy}>
              {busy ? "Saving…" : existing ? "Save tier" : "Create tier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TierCard({
  tier,
  onEdit,
  onDelete,
}: {
  tier: AuthorTierItem
  onEdit: () => void
  onDelete: () => Promise<void>
}) {
  const rupees = tier.price_cents / 100
  return (
    <div className="surface flex flex-col rounded-lg p-4 sm:p-6">
      <h2 className="font-display text-xl break-words text-foreground">
        {tier.name}
      </h2>
      <p className="mt-1 text-foreground">
        <span className="font-display text-2xl text-primary">
          {rupees === 0 ? "Free" : `₹${rupees.toFixed(0)}`}
        </span>
        {rupees > 0 && (
          <span className="text-sm text-muted-foreground"> / month</span>
        )}
      </p>
      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="size-4" aria-hidden />
        {plural(tier.supporters, "active supporter")}
      </p>
      {tier.description && (
        <p className="mt-4 text-sm break-words text-muted-foreground">
          {tier.description}
        </p>
      )}
      <ul className="mt-4 mb-4 flex-1 space-y-2 text-sm">
        {(tier.perks ?? []).map((p, i) => (
          <li key={i} className="flex gap-2 text-foreground/90">
            <Check
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden
            />
            <span className="min-w-0 break-words">{p}</span>
          </li>
        ))}
      </ul>
      {tier.razorpay_plan_id ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p
                tabIndex={0}
                className="mb-2 w-fit text-xs text-muted-foreground"
              >
                Billing plan ready
              </p>
            </TooltipTrigger>
            <TooltipContent>
              <span className="font-mono">{tier.razorpay_plan_id}</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <p className="mb-2 text-xs text-muted-foreground">
          Billing: not set up yet
        </p>
      )}
      <div className="hairline-t flex gap-2 pt-2">
        <Button variant="ghost" className="min-h-11" onClick={onEdit}>
          <Pencil className="size-4" aria-hidden /> Edit
        </Button>
        <ConfirmDialog
          trigger={
            <Button
              variant="ghost"
              className="min-h-11 text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden /> Delete
            </Button>
          }
          title={`Delete ${tier.name}?`}
          description={
            tier.supporters > 0
              ? `Its ${plural(tier.supporters, "supporter")} keep their membership until they cancel, but no one new can join.`
              : "This tier will be removed permanently."
          }
          destructive
          confirmLabel="Delete tier"
          onConfirm={onDelete}
        />
      </div>
    </div>
  )
}

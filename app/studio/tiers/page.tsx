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
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Pencil, X, Plus, Users, Lock } from "lucide-react"
import { AuthorTierItem } from "@/lib/types/content"
import { useMyPlan } from "@/hooks/use-my-plan"
import { hasStudioAccess } from "@/lib/plan"
import Link from "next/link"

export default function TiersPage() {
  const listFn = listMyTiers
  const createFn = createTier
  const updFn = updateTier
  const delFn = deleteTier
  const q = useQuery({ queryKey: ["my-tiers"], queryFn: () => listFn() })

  const [mounted, setMounted] = useState(false)
  useEffect(() => queueMicrotask(() => setMounted(true)), [])

  const { plan, loading: planLoading } = useMyPlan()
  const hasStudio = hasStudioAccess(plan)

  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("99")
  const [perksText, setPerksText] = useState("")

  const create = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      await createFn({
        data: {
          name,
          description: description || undefined,
          price_cents: Math.max(0, Math.floor(Number(price) * 100) || 0),
          perks: perksText
            .split("\n")
            .map((p: string) => p.trim())
            .filter(Boolean),
        },
      })
      toast.success("Tier created")
      setShowCreate(false)
      setName("")
      setDescription("")
      setPrice("99")
      setPerksText("")
      q.refetch()
    } catch (err) {
      toast.error((err as Error).message)
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
            Membership tiers and subscriptions are available on the Studio plan.
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
            Membership
          </p>
          <h1 className="font-display text-3xl text-foreground">
            Tiers & supporters
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
                <Plus className="mr-2 size-4" /> Create tier
              </>
            )}
          </Button>
        </div>
      </div>

      {showCreate && (
        <form
          onSubmit={create}
          className="surface mb-10 grid gap-4 rounded-md border border-border/60 p-6 md:grid-cols-2"
        >
          <div className="min-w-0">
            <Label>Tier name</Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Supporter"
            />
          </div>
          <div className="min-w-0">
            <Label>Monthly price (₹)</Label>
            <Input
              type="number"
              min="0"
              step="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="min-w-0 md:col-span-2">
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this tier promise?"
            />
          </div>
          <div className="min-w-0 md:col-span-2">
            <Label>Perks (one per line)</Label>
            <Textarea
              rows={4}
              value={perksText}
              onChange={(e) => setPerksText(e.target.value)}
              placeholder="Early access to drafts&#10;Member-only debates"
            />
          </div>
          <div className="min-w-0 md:col-span-2">
            <Button type="submit">
              <Plus className="mr-2 size-4" /> Create tier
            </Button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(q.data ?? []).map((t: AuthorTierItem) => (
          <TierCard
            key={t.id}
            tier={t}
            onUpdate={async (patch) => {
              await updFn({ data: { id: t.id, ...patch } })
              q.refetch()
            }}
            onDelete={async () => {
              await delFn({ data: { id: t.id } })
              toast.success("Tier deleted")
              q.refetch()
            }}
          />
        ))}
        {(q.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            No tiers yet — supporters need somewhere to land.
          </p>
        )}
      </div>
    </div>
  )
}

interface TierCardProps {
  tier: AuthorTierItem
  onUpdate: (p: {
    name?: string
    description?: string | null
    price_cents?: number
    perks?: string[]
  }) => Promise<void>
  onDelete: () => Promise<void>
}

function TierCard({ tier, onUpdate, onDelete }: TierCardProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(tier.name)
  const [description, setDescription] = useState(tier.description ?? "")
  const [price, setPrice] = useState(String(tier.price_cents / 100))
  const [perksText, setPerksText] = useState((tier.perks ?? []).join("\n"))

  const save = async () => {
    try {
      await onUpdate({
        name,
        description: description || null,
        price_cents: Math.max(0, Math.floor(Number(price) * 100) || 0),
        perks: perksText
          .split("\n")
          .map((p: string) => p.trim())
          .filter(Boolean),
      })
      toast.success("Updated")
      setEditing(false)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (editing) {
    return (
      <div className="surface-elevated space-y-2 rounded-md p-5">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          type="number"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <Textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Textarea
          rows={4}
          value={perksText}
          onChange={(e) => setPerksText(e.target.value)}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={save}>
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="surface flex flex-col rounded-md p-5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="font-display text-xl text-foreground">{tier.name}</h2>
        <span className="font-display text-2xl text-primary">
          ₹{(tier.price_cents / 100).toFixed(0)}
        </span>
      </div>
      <p className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="size-3" /> {tier.supporters} active supporter
        {tier.supporters === 1 ? "" : "s"}
      </p>
      {tier.description && (
        <p className="mb-3 text-sm text-muted-foreground">{tier.description}</p>
      )}
      <ul className="mb-4 flex-1 space-y-1 text-sm">
        {(tier.perks ?? []).map((p, i) => (
          <li key={i} className="text-foreground/90">
            — {p}
          </li>
        ))}
      </ul>
      <p className="mb-3 text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
        Razorpay plan
        <span className="ml-2 font-mono tracking-normal text-foreground/70 normal-case">
          {tier.razorpay_plan_id ?? "not provisioned"}
        </span>
      </p>
      <div className="hairline-t flex gap-1 pt-3">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="mr-1 size-4" /> Edit
        </Button>
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="sm">
              <X className="mr-1 size-4" /> Delete
            </Button>
          }
          title={`Delete ${tier.name}?`}
          description={
            tier.supporters > 0
              ? `This tier has ${tier.supporters} active supporter${tier.supporters === 1 ? "" : "s"}. Their memberships will remain but show as orphaned.`
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

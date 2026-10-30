import Link from "next/link"
import { CheckCircle2, Circle, ArrowRight, ChevronDown } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { createAdminClient, createClient } from "@/lib/supabase/server"

// Creator activation: publish → set a tier → first earnings.
// Renders nothing once all three are done.
export async function ActivationChecklist() {
  const supabase = await createAdminClient()
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  if (!user) return null

  const [{ count: published }, { count: tiers }, { count: paidTips }] =
    await Promise.all([
      supabase
        .from("content_objects")
        .select("*", { count: "exact", head: true })
        .eq("author_id", user.id)
        .eq("status", "published"),
      supabase
        .from("membership_tiers")
        .select("*", { count: "exact", head: true })
        .eq("author_id", user.id),
      supabase
        .from("tips")
        .select("*", { count: "exact", head: true })
        .eq("author_id", user.id)
        .eq("status", "paid"),
    ])

  const steps = [
    {
      done: (published ?? 0) > 0,
      label: "Publish your first piece",
      detail: "Readers can't find you until something is live.",
      href: "/studio/drafts",
    },
    {
      done: (tiers ?? 0) > 0,
      label: "Set up a membership tier",
      detail: "Give supporters a way to pay you every month.",
      href: "/studio/tiers",
    },
    {
      done: (paidTips ?? 0) > 0,
      label: "Earn your first tip",
      detail: "Share your piece — tips land directly in your earnings.",
      href: "/studio/earnings",
    },
  ]

  if (steps.every((s) => s.done)) return null
  const doneCount = steps.filter((s) => s.done).length

  return (
    <details className="group surface mb-8 rounded-lg">
      <summary className="flex min-h-11 cursor-pointer list-none flex-col gap-3 rounded-lg p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-display text-lg">Set up your studio</span>
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            {doneCount} of {steps.length} done
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </span>
        </span>
        <Progress value={(doneCount / steps.length) * 100} className="h-1.5" aria-label="Setup progress" />
      </summary>
      <ol className="px-2 pb-2 sm:px-3 sm:pb-3">
        {steps.map((s) => (
          <li key={s.label}>
            <Link
              href={s.href}
              className="flex min-h-11 items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent/40"
            >
              {s.done ? (
                <CheckCircle2 className="size-5 shrink-0 text-primary" aria-label="Done" />
              ) : (
                <Circle className="size-5 shrink-0 text-muted-foreground" aria-label="Not done" />
              )}
              <span className="min-w-0 flex-1">
                <span className={`block text-sm ${s.done ? "text-muted-foreground line-through" : "font-medium"}`}>
                  {s.label}
                </span>
                {!s.done && <span className="block text-sm text-muted-foreground">{s.detail}</span>}
              </span>
              {!s.done && <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
            </Link>
          </li>
        ))}
      </ol>
    </details>
  )
}

import Link from "next/link"
import { CheckCircle2, Circle, ArrowRight } from "lucide-react"
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
    <div className="hairline mb-8 rounded-lg p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] tracking-wider text-muted-foreground uppercase">
            Getting started
          </p>
          <h2 className="font-display text-lg">
            Set up your studio ({doneCount}/{steps.length})
          </h2>
        </div>
      </div>
      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.label}>
            <Link
              href={s.href}
              className="group flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-accent/40"
            >
              {s.done ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm ${s.done ? "text-muted-foreground line-through" : "font-medium"}`}
                >
                  {s.label}
                </span>
                {!s.done && (
                  <span className="block text-xs text-muted-foreground">
                    {s.detail}
                  </span>
                )}
              </span>
              {!s.done && (
                <ArrowRight className="mt-1 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              )}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}

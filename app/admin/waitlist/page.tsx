import { redirect } from "next/navigation"
import { ListChecks } from "lucide-react"
import { getMyRole } from "@/actions/content/profile"
import { listWaitlist } from "@/actions/waitlist"

export default async function WaitlistPage() {
  const { primary } = await getMyRole()
  if (primary !== "admin") redirect("/")

  let groups: Awaited<ReturnType<typeof listWaitlist>> = []
  let failed = false
  try {
    groups = await listWaitlist()
  } catch {
    failed = true
  }

  return (
    <div className="mx-auto w-full max-w-350 p-6 md:p-8">
      <header className="mb-6">
        <p className="mb-2 inline-flex items-center gap-2 text-xs tracking-[0.2em] text-muted-foreground uppercase">
          <ListChecks className="size-3.5" /> Admin
        </p>
        <h1 className="font-display text-3xl tracking-tight">Waitlist</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Who asked to be notified when each paid item opens up.
        </p>
      </header>

      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load waitlist. Refresh to try again.
        </p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No signups yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map(({ item, count, recent }) => (
            <section key={item} className="hairline rounded-lg px-4 py-3">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl">{item}</h2>
                <span data-testid="waitlist-count" className="text-2xl tabular-nums">
                  {count}
                </span>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {recent.slice(0, 10).map((r) => (
                  <li key={r.email + r.created_at} className="flex justify-between gap-3">
                    <span className="truncate">{r.email}</span>
                    <time className="shrink-0 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("en-IN")}
                    </time>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

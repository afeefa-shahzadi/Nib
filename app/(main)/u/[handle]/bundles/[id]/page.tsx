/* eslint-disable @typescript-eslint/no-explicit-any */
import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getPublicBundle } from "@/actions/content/bundles"
import { isLaunchFree } from "@/lib/plan"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BuyBundleButton } from "./buy-button"

type Props = { params: Promise<{ handle: string; id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle, id } = await params
  const b = await getPublicBundle(handle, id)
  if (!b) return { title: "Bundle — Nib" }
  return {
    title: `${b.title} — Nib`,
    description: b.outcome_statement ?? b.description ?? `A bundle by @${handle} on Nib.`,
  }
}

export default async function BundlePage({ params }: Props) {
  const { handle, id } = await params
  const b = await getPublicBundle(handle, id)
  if (!b) return notFound()
  const price = b.price > 0 ? `₹${(b.price / 100).toLocaleString("en-IN")}` : "Free"
  const name = b.author.display_name || b.author.handle

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href={`/u/${b.author.handle}`}
        className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <Avatar className="size-6">
          <AvatarImage src={b.author.avatar_url || ""} alt="" />
          <AvatarFallback className="text-xs">{name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        {name}
      </Link>

      <p className="mt-6 text-sm text-muted-foreground">Bundle · {b.items.length} {b.items.length === 1 ? "piece" : "pieces"}</p>
      <h1 className="mt-1 font-display text-3xl text-foreground sm:text-4xl">{b.title}</h1>
      {b.outcome_statement && <p className="mt-3 text-lg text-foreground/90">{b.outcome_statement}</p>}
      {b.description && <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{b.description}</p>}

      <div className="surface mt-8 flex flex-col gap-4 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="font-display text-2xl text-foreground">{price}</p>
          <p className="text-sm text-muted-foreground">
            {b.owned ? "You have this bundle" : b.price > 0 ? "One-time payment, yours to keep" : "Free to read"}
          </p>
        </div>
        {b.price > 0 && !b.owned && (
          <BuyBundleButton
            bundleId={b.id}
            price={price}
            signedIn={b.signedIn}
            paymentsOpen={!isLaunchFree()}
            next={`/u/${handle}/bundles/${id}`}
          />
        )}
      </div>

      <h2 className="mt-10 font-display text-xl text-foreground">What&apos;s inside</h2>
      {b.items.length === 0 ? (
        <p className="mt-3 text-muted-foreground">No pieces in this bundle yet.</p>
      ) : (
        <ol className="mt-3">
          {b.items.map((p: any, i: number) => (
            <li key={p.id} className="hairline-t last:hairline-b">
              <Link href={`/u/${p.author?.handle ?? b.author.handle}/${p.slug}`} className="group flex gap-4 py-4">
                <span className="w-6 shrink-0 pt-0.5 text-sm text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block font-medium text-foreground group-hover:text-primary">{p.title}</span>
                  {p.summary && <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{p.summary}</span>}
                  {p.author?.handle && p.author.handle !== b.author.handle && (
                    <span className="mt-1 block text-xs text-muted-foreground">by {p.author.display_name || p.author.handle}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  )
}

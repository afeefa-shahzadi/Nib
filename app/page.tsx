import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { SiteHeader, SiteFooter } from "@/components/site-chrome"
import { Button } from "@/components/ui/button"
import { HomeReaderPane } from "@/components/home-reader-pane"
import { FEATURE_BLOCKS, FAQ, STEPS, MODE_LINES } from "@/lib/content/landing/data"
import { createAdminClient } from "@/lib/supabase/server"
import { excludeNsfw } from "@/lib/nsfw"

// Static page, refreshed every 5 minutes: one DB read serves every visitor.
export const revalidate = 300

type Card = {
  id: string
  title: string
  slug: string
  summary: string | null
  cover_image_url: string | null
  tags: string[] | null
  author: { handle: string; display_name: string | null } | null
}

async function readingNow(): Promise<Card[]> {
  try {
    const db = await createAdminClient()
    const { data } = await excludeNsfw(
      db
        .from("content_objects")
        .select("id, title, slug, summary, cover_image_url, tags, author:profiles!author_id(handle, display_name)")
        .eq("status", "published")
        .eq("visibility", "public")
        .order("published_at", { ascending: false })
        .limit(12)
    )
    const rows = (data ?? []) as unknown as Card[]
    // Pieces with covers lead; the rest fill the text list.
    return [...rows.filter((r) => r.cover_image_url), ...rows.filter((r) => !r.cover_image_url)].slice(0, 6)
  } catch {
    return []
  }
}

const href = (c: Card) => `/u/${c.author?.handle ?? "_"}/${c.slug}`
const byline = (c: Card) => c.author?.display_name || (c.author ? `@${c.author.handle}` : "")

export default async function Landing() {
  const pieces = await readingNow()
  const [lead, ...rest] = pieces
  const side = rest.slice(0, 2)
  const list = rest.slice(2, 5)

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* HERO */}
        <section className="container-wide grid gap-12 py-16 md:py-24 lg:grid-cols-12 lg:items-center lg:gap-16">
          <div className="min-w-0 lg:col-span-6">
            <h1 className="font-display text-[2.75rem] leading-[1.05] md:text-6xl">
              Read it{" "}
              <span className="relative inline-block">
                your way.
                <svg
                  aria-hidden
                  viewBox="0 0 300 24"
                  preserveAspectRatio="none"
                  className="ink-stroke absolute -bottom-2 left-0 h-3 w-full text-primary md:-bottom-3 md:h-4"
                >
                  <path d="M4 16 C 70 6, 150 4, 296 12" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                </svg>
              </span>
              <br />
              Write it once.
            </h1>
            <p className="mt-8 max-w-[34rem] text-lg leading-relaxed text-muted-foreground md:text-xl">
              Essays, guides and serial fiction you can read as a two-minute
              skim, the full piece, or the expert cut. Free to read, free to
              write.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/feed">Start reading</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/signup">
                  Start writing <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="min-w-0 lg:col-span-6">
            <HomeReaderPane />
          </div>
        </section>

        {/* READING NOW */}
        {lead && (
          <section className="hairline-t">
            <div className="container-wide py-16 md:py-24">
              <div className="mb-8 flex items-baseline justify-between gap-4">
                <h2 className="font-display text-3xl md:text-4xl">Reading now</h2>
                <Link href="/feed" className="shrink-0 text-sm text-muted-foreground hover:text-foreground">
                  See the feed →
                </Link>
              </div>
              <div className="grid gap-8 md:grid-cols-3">
                {[lead, ...side].map((c) => (
                  <Link key={c.id} href={href(c)} className="group block">
                    {c.cover_image_url && (
                      <div className="relative mb-4 aspect-[3/2] overflow-hidden rounded-xl bg-muted">
                        <Image
                          src={c.cover_image_url}
                          alt=""
                          fill
                          sizes="(min-width: 1024px) 400px, (min-width: 768px) 33vw, 100vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none"
                        />
                      </div>
                    )}
                    {c.tags?.[0] && <p className="text-xs text-muted-foreground">{c.tags[0]}</p>}
                    <h3 className="mt-1 font-display text-xl leading-snug group-hover:underline group-hover:underline-offset-4 md:text-2xl">
                      {c.title}
                    </h3>
                    {c.summary && <p className="mt-2 line-clamp-2 text-muted-foreground">{c.summary}</p>}
                    <p className="mt-2 text-sm text-muted-foreground">{byline(c)}</p>
                  </Link>
                ))}
              </div>
              {list.length > 0 && (
                <ul className="mt-10 grid md:grid-cols-3 md:gap-x-8">
                  {list.map((c) => (
                    <li key={c.id} className="hairline-t">
                      <Link href={href(c)} className="block py-4 hover:text-foreground">
                        <span className="block font-display text-lg leading-snug">{c.title}</span>
                        <span className="text-sm text-muted-foreground">{byline(c)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* MODES */}
        <section className="hairline-t">
          <div className="container-wide py-16 md:py-24">
            <h2 className="font-display text-3xl md:text-4xl">One piece, five ways in</h2>
            <dl className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
              {MODE_LINES.map((m) => (
                <div key={m.name}>
                  <dt className="font-display text-xl">{m.name}</dt>
                  <dd className="mt-1 text-muted-foreground">{m.line}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* FEATURES */}
        <section className="hairline-t">
          <div className="container-wide py-16 md:py-24">
            <div className="mb-10 flex items-baseline justify-between gap-4">
              <h2 className="font-display text-3xl md:text-4xl">Built for ideas that grow</h2>
              <Link href="/product" className="hidden shrink-0 text-sm text-muted-foreground hover:text-foreground sm:inline">
                Everything Nib does →
              </Link>
            </div>
            <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURE_BLOCKS.map((f) => (
                <div key={f.label}>
                  <dt className="font-display text-xl">
                    <Link href={`/product#${f.anchor}`} className="hover:underline hover:underline-offset-4">
                      {f.label}
                    </Link>
                  </dt>
                  <dd className="mt-1 text-muted-foreground">{f.body}</dd>
                </div>
              ))}
            </dl>
            <Link href="/product" className="mt-8 inline-block text-sm text-muted-foreground hover:text-foreground sm:hidden">
              Everything Nib does →
            </Link>
          </div>
        </section>

        {/* WRITERS */}
        <section className="hairline-t">
          <div className="container-wide grid gap-10 py-16 md:py-24 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <h2 className="font-display text-3xl md:text-4xl">For writers</h2>
              <p className="mt-4 max-w-[34rem] text-lg leading-relaxed text-muted-foreground">
                Write in an editor that feels normal. Choose what each mode
                shows if you want to. Readers pay you directly, and there are
                no ads.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/signup">Start writing</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/pricing">See pricing</Link>
                </Button>
              </div>
            </div>
            <ol className="lg:col-span-7">
              {STEPS.map((s) => (
                <li key={s.n} className="hairline-t flex gap-6 py-5 last:hairline-b">
                  <span className="w-6 shrink-0 font-display text-xl text-muted-foreground">{s.n}</span>
                  <div>
                    <h3 className="font-display text-xl">{s.title}</h3>
                    <p className="mt-1 text-muted-foreground">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section className="hairline-t">
          <div className="container-wide grid gap-8 py-16 md:py-24 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <h2 className="font-display text-3xl md:text-4xl">Questions</h2>
              <Link href="/docs" className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground">
                Full documentation →
              </Link>
            </div>
            <div className="lg:col-span-7">
              {FAQ.map((f) => (
                <details key={f.q} className="group hairline-t last:hairline-b">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-display text-xl [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45 motion-reduce:transition-none">+</span>
                  </summary>
                  <p className="max-w-[42.5rem] pb-5 leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

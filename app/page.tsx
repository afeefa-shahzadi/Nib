import { SiteHeader, SiteFooter } from "@/components/site-chrome"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { FEATURE_BLOCKS, FAQ, STEPS } from "@/lib/content/landing/data"
import { HomeReaderPane } from "@/components/home-reader-pane"

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 opacity-40 [background:radial-gradient(60%_50%_at_50%_0%,var(--color-primary)_0%,transparent_60%)]" />
          <div className="container-wide grid gap-12 pt-16 pb-20 md:pt-24 md:pb-24 lg:grid-cols-12 lg:items-start">
            <div className="min-w-0 lg:col-span-6">
              <p className="mb-6 text-xs tracking-[0.22em] text-primary uppercase">
                Post-native publishing
              </p>
              <h1 className="font-display text-5xl leading-[1.02] tracking-tight md:text-7xl lg:text-[5.5rem]">
                Write once.
                <br />
                <span className="text-muted-foreground">Readers choose the shape.</span>
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
                One draft, several ways in. Switch the mode on the piece and see.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href="/signup">
                    Start writing <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/docs">Read the docs</Link>
                </Button>
              </div>
            </div>
            <div className="min-w-0 lg:col-span-6">
              <HomeReaderPane />
            </div>
          </div>
        </section>

        {/* CAPABILITIES */}
        <section className="hairline-t">
          <div className="container-wide grid gap-10 py-24 md:grid-cols-12">
            <div className="md:col-span-4">
              <h2 className="font-display text-4xl leading-tight md:text-5xl">
                What a piece is made of.
              </h2>
              <p className="mt-5 leading-relaxed text-muted-foreground">
                Blocks, reading modes, branches, bundles and debates.
              </p>
            </div>
            <dl className="space-y-px md:col-span-8">
              {FEATURE_BLOCKS.map((f) => (
                <div key={f.label} className="hairline-t last:hairline-b grid gap-2 py-6 md:grid-cols-3 md:gap-6">
                  <dt className="font-display text-xl">{f.label}</dt>
                  <dd className="leading-relaxed text-muted-foreground md:col-span-2">
                    <span className="text-foreground">{f.title}</span> {f.body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* WORKFLOW */}
        <section className="hairline-t">
          <div className="container-wide py-24">
            <h2 className="max-w-3xl font-display text-4xl leading-tight md:text-5xl">
              From first draft to paid bundle.
            </h2>
            <ol className="mt-14 space-y-px">
              {STEPS.map((s) => (
                <li
                  key={s.n}
                  className="hairline-t last:hairline-b grid gap-6 py-8 md:grid-cols-12"
                >
                  <div className="font-display text-2xl text-muted-foreground md:col-span-1">
                    {s.n}
                  </div>
                  <h3 className="font-display text-2xl leading-tight md:col-span-5">
                    {s.title}
                  </h3>
                  <p className="leading-relaxed text-muted-foreground md:col-span-6">
                    {s.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ TEASER */}
        <section className="hairline-t">
          <div className="container-wide grid gap-10 py-24 md:grid-cols-12">
            <div className="md:col-span-4">
              <h2 className="font-display text-4xl leading-tight">
                Common questions, short answers.
              </h2>
              <Button asChild variant="link" className="mt-4 px-0">
                <Link href="/docs">Full documentation →</Link>
              </Button>
            </div>
            <dl className="space-y-px md:col-span-8">
              {FAQ.map((f) => (
                <div key={f.q} className="hairline-t last:hairline-b py-6">
                  <dt className="mb-2 font-display text-xl">{f.q}</dt>
                  <dd className="leading-relaxed text-muted-foreground">
                    {f.a}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="hairline-t">
          <div className="container-wide py-20 text-center md:py-24">
            <h2 className="mx-auto max-w-3xl font-display text-4xl leading-[1.05] md:text-6xl">
              The publishing surface for what you actually know.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              Free to write. Paid when you sell.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/signup">Start writing</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing">See pricing</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

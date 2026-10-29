import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { Metadata } from "next"
import { PILLARS } from "@/lib/content/product/data"

export const metadata: Metadata = {
  title: "Product — Nib",
  description:
    "Modes, branches, bundles, debates: how Nib turns one draft into many readers.",
  openGraph: {
    title: "Product — Nib",
    description: "How Nib turns one draft into many readers.",
    url: "/product",
  },
  alternates: {
    canonical: "/product",
  },
}

export default function Product() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Nib",
    description:
      "Modes, branches, bundles, debates: how Nib turns one draft into many readers.",
    brand: { "@type": "Brand", name: "Nib" },
    category: "Publishing platform",
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="flex-1">
        <section className="container-wide pt-16 md:pt-24 pb-16">
          <h1 className="max-w-3xl font-display text-5xl leading-[1.05] md:text-6xl">
            Everything Nib does
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            A piece on Nib is built from blocks, so the same writing can be
            skimmed, studied, debated, translated or sold. Here is each part
            in detail.
          </p>
          <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-2">
            {PILLARS.map((p) => (
              <a
                key={p.id}
                href={`#${p.id}`}
                className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
              >
                {p.label}
              </a>
            ))}
          </nav>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Create your studio</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/docs">Read the docs</Link>
            </Button>
          </div>
        </section>

        {PILLARS.map((p) => {
          const Icon = p.icon
          return (
            <section key={p.label} id={p.id} className="hairline-t scroll-mt-16">
              <div className="container-wide grid items-start gap-10 py-16 md:grid-cols-12 md:gap-12 md:py-24">
                <div className="md:sticky md:top-24 md:col-span-5">
                  <p className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Icon aria-hidden className="size-4" />
                    {p.label}
                  </p>
                  <h2 className="font-display text-3xl leading-tight md:text-4xl">
                    {p.title}
                  </h2>
                  <p className="mt-5 leading-relaxed text-muted-foreground">
                    {p.body}
                  </p>
                </div>
                <ul className="md:col-span-7">
                  {p.bullets.map((b) => (
                    <li
                      key={b}
                      className="hairline-t last:hairline-b flex items-start gap-4 py-4"
                    >
                      <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="text-foreground/90">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )
        })}

        <section className="hairline-t">
          <div className="container-wide py-16 text-center md:py-24">
            <h2 className="mx-auto max-w-3xl font-display text-4xl md:text-5xl">
              Start with one piece.
            </h2>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/signup">Create your studio</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing">See pricing</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

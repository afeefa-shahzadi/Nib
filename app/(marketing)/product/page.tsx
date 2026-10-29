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
          <p className="text-xs tracking-[0.22em] text-primary uppercase">
            Product
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl leading-[1.05] md:text-7xl">
            A creator OS shaped like
            <br />
            an idea — not a page.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Nib replaces the article with an adaptive knowledge object.
            Same source. Many surfaces. Eight pillars, one consistent model.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Create your studio</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/docs">Read the docs</Link>
            </Button>
          </div>
        </section>

        {PILLARS.map((p, i) => {
          const Icon = p.icon
          const reverse = i % 2 === 1
          return (
            <section key={p.label} className="hairline-t">
              <div className="container-wide grid items-start gap-12 py-20 md:grid-cols-12">
                <div className={`md:col-span-5 ${reverse ? "md:order-2" : ""}`}>
                  <Icon className="mb-5 size-6 text-primary" />
                  <p className="mb-3 text-sm font-medium text-primary">
                    {p.label}
                  </p>
                  <h2 className="font-display text-3xl leading-tight md:text-4xl">
                    {p.title}
                  </h2>
                  <p className="mt-5 leading-relaxed text-muted-foreground">
                    {p.body}
                  </p>
                </div>
                <ul
                  className={`space-y-px md:col-span-7 ${reverse ? "md:order-1" : ""}`}
                >
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
          <div className="container-wide py-28 text-center">
            <h2 className="mx-auto max-w-3xl font-display text-4xl md:text-5xl">
              Stop publishing pages. Start publishing knowledge.
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

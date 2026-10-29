import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { Metadata } from "next"
import { PRINCIPLES } from "@/lib/content/about/data"

export const metadata: Metadata = {
  title: "About — Nib",
  description:
    "Why we're building a creator OS shaped like knowledge, not a feed.",
  openGraph: {
    title: "About — Nib",
    description: "A creator OS shaped like knowledge.",
    url: "/about",
  },
  alternates: {
    canonical: "/about",
  },
}

export default function About() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About Nib",
    description:
      "Why we're building a creator OS shaped like knowledge, not a feed.",
    publisher: { "@type": "Organization", name: "Nib" },
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="flex-1">
        <section className="container-wide max-w-3xl pt-16 md:pt-24 pb-16">
          <p className="text-xs tracking-[0.2em] text-primary uppercase">
            Manifesto
          </p>
          <h1 className="mt-4 font-display text-5xl leading-[1.03] md:text-7xl">
            The article is a 19th-century artifact.
          </h1>
          <div className="mt-10 space-y-6 text-lg leading-relaxed text-foreground/85">
            <p>
              For two centuries, &quot;publishing&quot; has meant pouring an
              idea into a fixed shape — a column, a page, a post — and hoping
              the right reader finds it.
            </p>
            <p>
              The internet didn&apos;t change that. It just multiplied the
              pages. Creators still write one version of an idea and ship it
              into a feed that flattens it.
            </p>
            <p>
              Nib is built on a different bet:{" "}
              <span className="text-foreground">
                a piece of knowledge is not a page
              </span>
              . It&apos;s a structure — claims, evidence, scaffolding,
              counter-arguments — that should reshape itself for the reader in
              front of it.
            </p>
            <p>
              A skimmer should get the spine. An expert should get the proofs. A
              student should get the scaffolding. A debater should see the
              contested claims. From <em>one</em> draft.
            </p>
            <p>That&apos;s what we&apos;re building.</p>
          </div>
        </section>

        <section className="hairline-t">
          <div className="container-wide py-20">
            <h2 className="mb-12 max-w-2xl font-display text-4xl md:text-5xl">
              Six commitments that shape every decision.
            </h2>
            <div className="grid gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 md:grid-cols-2">
              {PRINCIPLES.map((p) => (
                <div key={p.n} className="surface p-8">
                  <p className="font-mono text-xs text-primary">{p.n}</p>
                  <h3 className="mt-3 font-display text-2xl leading-tight">
                    {p.t}
                  </h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">
                    {p.b}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="hairline-t">
          <div className="container-wide max-w-3xl py-20">
            <h2 className="mb-8 font-display text-4xl leading-tight">
              Essayists, researchers, teachers, analysts — anyone whose work has
              a structure.
            </h2>
            <div className="space-y-5 leading-relaxed text-muted-foreground">
              <p>
                If your output is dispatches — a newsletter, a daily note, a
                weekly summary — there are good tools for that. This isn&apos;t
                one of them.
              </p>
              <p>
                If your output is{" "}
                <span className="text-foreground">
                  ideas with internal architecture
                </span>{" "}
                — arguments, frameworks, courses, dossiers — and you currently
                squeeze them into formats that lose half the shape, Nib was
                built for you.
              </p>
              <p>
                We are a small, independent team in India. We charge for the
                platform when you monetize on it. We don&apos;t run ads. We
                don&apos;t sell your audience. We won&apos;t.
              </p>
            </div>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/signup">Start your studio</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/product">See the product</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

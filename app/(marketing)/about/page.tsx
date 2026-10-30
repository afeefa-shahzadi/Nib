import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { Metadata } from "next"
import { PRINCIPLES } from "@/lib/content/about/data"

const DESCRIPTION = "Why Nib treats writing as structure, not pages, and who it's for."

export const metadata: Metadata = {
  title: "About — Nib",
  description: DESCRIPTION,
  openGraph: { title: "About — Nib", description: DESCRIPTION, url: "/about" },
  alternates: { canonical: "/about" },
}

export default function About() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About Nib",
    description: DESCRIPTION,
    publisher: { "@type": "Organization", name: "Nib" },
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="flex-1">
        <section className="container-wide pt-16 pb-16 md:pt-24 md:pb-24">
          <h1 className="max-w-3xl font-display text-4xl leading-[1.05] sm:text-5xl md:text-6xl">
            The article is a 19th&#8209;century format.
          </h1>
          <div className="mt-10 max-w-[38rem] space-y-6 text-lg leading-relaxed text-foreground/85">
            <p>
              For two centuries, publishing has meant pouring an idea into a
              fixed shape, a column or a page or a post, and hoping the right
              reader finds it.
            </p>
            <p>
              The internet multiplied the pages without changing the shape.
              Writers still produce one version of an idea and post it into a
              feed that flattens it.
            </p>
            <p>
              Nib starts from a different idea:{" "}
              <span className="text-foreground">a piece of writing has a structure</span>.
              Claims, evidence, examples and counter-arguments can reshape
              themselves for whoever is reading.
            </p>
            <p>
              A skimmer gets the main points. An expert gets the evidence. A
              student gets the explanations. A debater sees the contested
              claims. All from <em>one</em> draft.
            </p>
          </div>
        </section>

        <section className="hairline-t">
          <div className="container-wide grid items-start gap-10 py-16 md:grid-cols-12 md:gap-12 md:py-24">
            <div className="md:sticky md:top-24 md:col-span-5">
              <h2 className="font-display text-3xl leading-tight md:text-4xl">
                What we believe
              </h2>
              <p className="mt-5 leading-relaxed text-muted-foreground">
                Six ideas behind every decision we make about Nib.
              </p>
            </div>
            <ul className="md:col-span-7">
              {PRINCIPLES.map((p) => (
                <li key={p.t} className="hairline-t last:hairline-b py-6">
                  <h3 className="font-display text-xl leading-snug">{p.t}</h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{p.b}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="hairline-t">
          <div className="container-wide grid items-start gap-10 py-16 md:grid-cols-12 md:gap-12 md:py-24">
            <h2 className="font-display text-3xl leading-tight md:col-span-5 md:text-4xl">
              Who it&apos;s for
            </h2>
            <div className="space-y-5 leading-relaxed text-muted-foreground md:col-span-7">
              <p>
                Essayists, researchers, teachers, analysts: anyone whose work
                has a shape worth keeping.
              </p>
              <p>
                If you write quick dispatches, like a daily note or a weekly
                roundup, there are good tools for that. Nib isn&apos;t trying to
                be one of them.
              </p>
              <p>
                If you write{" "}
                <span className="text-foreground">ideas with internal structure</span>,
                like arguments, frameworks, courses or reports, and today they
                lose half their shape in a newsletter, Nib was built for you.
              </p>
              <p>
                We&apos;re a small, independent team in India. We don&apos;t run
                ads and we don&apos;t sell your audience.
              </p>
            </div>
          </div>
        </section>

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
                <Link href="/product">See how it works</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

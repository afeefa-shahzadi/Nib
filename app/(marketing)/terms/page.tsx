import type { Metadata } from "next"
import { SECTIONS } from "@/lib/content/terms/data"

export const metadata: Metadata = {
  title: "Terms & Conditions — Nib",
  description: "The rules of using Nib as a reader or author.",
  openGraph: {
    title: "Terms & Conditions — Nib",
    description: "Rules of using Nib.",
    url: "/terms",
  },
  alternates: {
    canonical: "/terms",
  },
}

export default function Terms() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        <section className="container-wide max-w-3xl pt-16 md:pt-24 pb-12">
          <p className="text-xs tracking-[0.2em] text-primary uppercase">
            Legal
          </p>
          <h1 className="mt-4 font-display text-5xl leading-[1.05] md:text-6xl">
            Terms & Conditions
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Last updated: May 31, 2026
          </p>
          <p className="mt-8 text-lg leading-relaxed text-foreground/85">
            The rules of using Nib — what you can do, what we&apos;ll do,
            and how we share responsibility.
          </p>
        </section>

        <section className="hairline-t">
          <div className="container-wide max-w-3xl space-y-10 py-16">
            {SECTIONS.map((s) => (
              <div key={s.h}>
                <h2 className="font-display text-2xl leading-tight">{s.h}</h2>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  {s.b}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

import type { Metadata } from "next"
import { SECTIONS } from "@/lib/content/privacy/data"

export const metadata: Metadata = {
  title: "Privacy Policy — Nib",
  description: "How Nib collects, uses, and protects your data.",
  openGraph: {
    title: "Privacy Policy — Nib",
    description: "How Nib handles your data.",
    url: "/privacy",
  },
  alternates: {
    canonical: "/privacy",
  },
}

export default function Privacy() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        <section className="container-wide max-w-3xl pt-16 md:pt-24 pb-12">
          <p className="text-xs tracking-[0.2em] text-primary uppercase">
            Legal
          </p>
          <h1 className="mt-4 font-display text-5xl leading-[1.05] md:text-6xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Last updated: October 30, 2026
          </p>
          <p className="mt-8 text-lg leading-relaxed text-foreground/85">
            We try to collect as little as possible, explain what we keep, and
            give you real control. This page is the long form.
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

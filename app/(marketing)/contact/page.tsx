import { ContactForm } from "./contact-form"
import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { CONTACT_EMAIL } from "@/lib/brand"

export const metadata: Metadata = {
  title: "Contact — Nib",
  description: "Questions, bug reports, ideas, or plans for your team: write to the Nib team.",
  alternates: { canonical: "/contact" },
}

export default function Contact() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        <section className="container-wide grid items-start gap-10 pt-16 pb-16 md:pt-24 md:pb-24 lg:grid-cols-12 lg:gap-12">
          <div className="lg:sticky lg:top-24 lg:col-span-5">
            <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">
              Get in touch
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-foreground/85">
              A question, a bug, an idea, or a plan for your team. A person
              reads every message.
            </p>
            <dl className="mt-10 space-y-6">
              <div>
                <dt className="text-sm text-muted-foreground">Prefer email?</dt>
                <dd className="mt-1">
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="-my-3 inline-block py-3 font-medium text-primary hover:underline hover:underline-offset-4"
                  >
                    {CONTACT_EMAIL}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Looking for how something works?</dt>
                <dd className="mt-1">
                  <Link
                    href="/docs"
                    className="-my-3 inline-block py-3 font-medium text-primary hover:underline hover:underline-offset-4"
                  >
                    Read the docs →
                  </Link>
                </dd>
              </div>
            </dl>
          </div>
          <div className="lg:col-span-7">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}>
              <ContactForm />
            </Suspense>
          </div>
        </section>
      </main>
    </div>
  )
}

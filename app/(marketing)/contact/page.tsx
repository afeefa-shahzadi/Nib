import { ContactForm } from "./contact-form"
import { Suspense } from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact — Nib",
  description: "Get in touch with the Nib team.",
}

export default function Contact() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        <section className="container-wide max-w-3xl pt-16 md:pt-24 pb-16">
          <p className="text-xs tracking-[0.2em] text-primary uppercase">
            Contact
          </p>
          <h1 className="mt-4 font-display text-5xl leading-[1.03] md:text-7xl">
            We&apos;d love to hear from you.
          </h1>
          <div className="mt-10 space-y-6 text-lg leading-relaxed text-foreground/85">
            <p>
              Whether you have a question about our pricing, need help setting
              up your studio, or just want to chat about the future of
              publishing, we&apos;re here for it.
            </p>
            
            <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
              <ContactForm />
            </Suspense>

          </div>
        </section>
      </main>
    </div>
  )
}

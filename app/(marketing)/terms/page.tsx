import type { Metadata } from "next"
import { LegalPage } from "@/components/legal-page"
import { SECTIONS } from "@/lib/content/terms/data"

export const metadata: Metadata = {
  title: "Terms of service — Nib",
  description: "The rules for using Nib as a reader or writer.",
  openGraph: { title: "Terms of service — Nib", description: "The rules for using Nib as a reader or writer.", url: "/terms" },
  alternates: { canonical: "/terms" },
}

export default function Page() {
  return (
    <LegalPage
      title="Terms of service"
      updated="October 30, 2026"
      intro="The rules for using Nib: what you can do, what we will do, and how we share responsibility."
      sections={SECTIONS}
    />
  )
}

import type { Metadata } from "next"
import { LegalPage } from "@/components/legal-page"
import { SECTIONS } from "@/lib/content/privacy/data"

export const metadata: Metadata = {
  title: "Privacy policy — Nib",
  description: "How Nib collects, uses, and protects your data.",
  openGraph: { title: "Privacy policy — Nib", description: "How Nib collects, uses, and protects your data.", url: "/privacy" },
  alternates: { canonical: "/privacy" },
}

export default function Page() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="October 30, 2026"
      intro="We collect as little as we can, explain what we keep, and give you real control over it."
      sections={SECTIONS}
    />
  )
}

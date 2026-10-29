import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Collections — Nib",
  description: "Curated knowledge bundles from top authors.",
  openGraph: {
    title: "Collections — Nib",
    description: "Curated knowledge bundles from top authors.",
    url: "/collections",
  },
  alternates: {
    canonical: "/collections",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

import type { Metadata } from "next"
export const metadata: Metadata = {
  title: "Docs — Nib",
  description:
    "Everything about Nib — concepts, composer, modes, branches, bundles, monetization. With live interactive demos.",
  openGraph: {
    title: "Docs — Nib",
    description: "Learn Nib with interactive demos and worked examples.",
    url: "/docs",
  },
  alternates: {
    canonical: "/docs",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

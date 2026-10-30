import type { Metadata } from "next"
export const metadata: Metadata = {
  title: "Bundles — Nib",

  openGraph: {
    title: "Bundles — Nib",

    url: "/studio/bundles",
  },
  alternates: {
    canonical: "/studio/bundles",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

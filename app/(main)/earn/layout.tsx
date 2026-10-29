import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Earn — Nib",
  description:
    "How to earn money and reputation by writing and curating on Nib.",
  openGraph: {
    title: "Earn — Nib",
    description:
      "How to earn money and reputation by writing and curating on Nib.",
    url: "/earn",
  },
  alternates: {
    canonical: "/earn",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

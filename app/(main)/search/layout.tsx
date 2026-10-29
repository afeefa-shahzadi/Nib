import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Search — Nib",
  description:
    "Search for pieces, authors, and topics across the Nib network.",
  openGraph: {
    title: "Search — Nib",
    description:
      "Search for pieces, authors, and topics across the Nib network.",
    url: "/search",
  },
  alternates: {
    canonical: "/search",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

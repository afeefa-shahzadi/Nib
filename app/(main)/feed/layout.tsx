import type { Metadata } from "next"
export const metadata: Metadata = {
  title: "Feed — Nib",
  description:
    "Latest pieces from authors you follow and the broader Nib network.",
  openGraph: {
    title: "Feed — Nib",
    description: "Latest pieces from authors you follow.",
    url: "/feed",
  },
  alternates: {
    canonical: "/feed",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

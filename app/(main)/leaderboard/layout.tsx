import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Leaderboard — Nib",
  description:
    "Top authors on Nib based on Insight Points and reading depth.",
  openGraph: {
    title: "Leaderboard — Nib",
    description:
      "Top authors on Nib based on Insight Points and reading depth.",
    url: "/leaderboard",
  },
  alternates: {
    canonical: "/leaderboard",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

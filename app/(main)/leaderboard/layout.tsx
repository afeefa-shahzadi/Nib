import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Leaderboard — Nib",
  description:
    "The most-read writers and most active readers on Nib, this week, this month and all time.",
  openGraph: {
    title: "Leaderboard — Nib",
    description:
      "The most-read writers and most active readers on Nib, this week, this month and all time.",
    url: "/leaderboard",
  },
  alternates: {
    canonical: "/leaderboard",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

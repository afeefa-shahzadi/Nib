import type { Metadata } from "next"
export const metadata: Metadata = {
  title: "Daily Quests — Studio · Nib",

  openGraph: {
    title: "Daily Quests — Studio · Nib",

    url: "/studio/quests",
  },
  alternates: {
    canonical: "/studio/quests",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

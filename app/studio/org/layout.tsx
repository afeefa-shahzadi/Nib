import type { Metadata } from "next"
export const metadata: Metadata = {
  title: "Organizations — Studio",

  openGraph: {
    title: "Organizations — Studio",

    url: "/studio/org",
  },
  alternates: {
    canonical: "/studio/org",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

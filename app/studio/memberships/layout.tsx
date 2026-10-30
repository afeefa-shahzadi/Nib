import type { Metadata } from "next"
export const metadata: Metadata = {
  title: "Memberships — Nib",

  openGraph: {
    title: "Memberships — Nib",

    url: "/studio/memberships",
  },
  alternates: {
    canonical: "/studio/memberships",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

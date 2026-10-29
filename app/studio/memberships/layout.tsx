import type { Metadata } from "next"
export const metadata: Metadata = {
  title: "My memberships — Nib",

  openGraph: {
    title: "My memberships — Nib",

    url: "/studio/memberships",
  },
  alternates: {
    canonical: "/studio/memberships",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

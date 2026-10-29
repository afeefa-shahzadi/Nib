import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign in — Nib",
  description: "Sign in to your Nib studio.",
  openGraph: {
    title: "Sign in — Nib",
    description: "Sign in to your Nib studio.",
    url: "/login",
  },
  alternates: {
    canonical: "/login",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

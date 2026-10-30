import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign up — Nib",
  description: "Join Nib to read, write or run a shared workspace. Free during launch.",
  openGraph: {
    title: "Sign up — Nib",
    description: "Join Nib to read, write or run a shared workspace. Free during launch.",
    url: "/signup",
  },
  alternates: {
    canonical: "/signup",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

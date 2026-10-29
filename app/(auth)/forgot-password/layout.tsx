import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Reset password — Nib",
  description: "Recover your Nib account.",
  openGraph: {
    title: "Reset password — Nib",
    description: "Recover your Nib account.",
    url: "/forgot-password",
  },
  alternates: {
    canonical: "/forgot-password",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

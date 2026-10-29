import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Set new password — Nib",
  description: "Set a new password for your Nib account.",
  openGraph: {
    title: "Set new password — Nib",
    description: "Set a new password for your Nib account.",
    url: "/reset-password",
  },
  alternates: {
    canonical: "/reset-password",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

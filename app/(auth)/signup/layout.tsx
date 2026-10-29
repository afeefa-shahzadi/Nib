import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Create your studio — Nib",
  description: "Start publishing knowledge, not pages.",
  openGraph: {
    title: "Create your studio — Nib",
    description: "Start publishing knowledge, not pages.",
    url: "/signup",
  },
  alternates: {
    canonical: "/signup",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

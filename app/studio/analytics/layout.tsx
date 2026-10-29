import type { Metadata } from "next"
export const metadata: Metadata = {
  title: "Analytics — Studio · Nib",

  openGraph: {
    title: "Analytics — Studio · Nib",

    url: "/studio/analytics",
  },
  alternates: {
    canonical: "/studio/analytics",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

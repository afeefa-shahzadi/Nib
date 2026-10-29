import type { Metadata } from "next"
export const metadata: Metadata = {
  title: "Earnings — Studio · Nib",

  openGraph: {
    title: "Earnings — Studio · Nib",

    url: "/studio/earnings",
  },
  alternates: {
    canonical: "/studio/earnings",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

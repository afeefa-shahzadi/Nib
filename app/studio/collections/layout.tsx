import type { Metadata } from "next"
export const metadata: Metadata = {
  title: "Collections — Studio · Nib",

  openGraph: {
    title: "Collections — Studio · Nib",

    url: "/studio/collections",
  },
  alternates: {
    canonical: "/studio/collections",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

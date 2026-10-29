import type { Metadata } from "next"
import StudioLayoutClient from "./layout-client"
import { getMyRole } from "@/actions/content"
import { StudioRole } from "@/hooks/use-my-role"
import { RestrictionBanner } from "@/components/restriction-banner"

export const metadata: Metadata = {
  title: "Studio — Nib",

  openGraph: {
    title: "Studio — Nib",

    url: "/studio",
  },
  alternates: {
    canonical: "/studio",
  },
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { primary } = await getMyRole()
  return (
    <StudioLayoutClient initialRole={primary as StudioRole}>
      <RestrictionBanner />
      {children}
    </StudioLayoutClient>
  )
}

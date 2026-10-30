import { SiteHeader, SiteFooter } from "@/components/site-chrome"
import { ConsentBanner } from "@/components/auth/consent-banner"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <ConsentBanner />
      {children}
      <SiteFooter />
    </>
  )
}

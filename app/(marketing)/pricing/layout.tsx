import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Pricing — Nib",
  description:
    "Free to read and write. Studio for pro authors. Organizations for teams. No ads, ever.",
  openGraph: {
    title: "Pricing — Nib",
    description: "Free to write. Paid when you scale or collaborate.",
    url: "/pricing",
  },
  alternates: {
    canonical: "/pricing",
  },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Nib",
    description: "Adaptive publishing platform for serious creators.",
    brand: { "@type": "Brand", name: "Nib" },
    offers: [
      { "@type": "Offer", name: "Free", price: "0", priceCurrency: "INR" },
      { "@type": "Offer", name: "Studio", price: "499", priceCurrency: "INR" },
      {
        "@type": "Offer",
        name: "Organizations",
        price: "299",
        priceCurrency: "INR",
        description: "per seat / month, 3 seat minimum",
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  )
}

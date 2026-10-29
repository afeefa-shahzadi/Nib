import type { Metadata } from "next"
import { Fraunces, Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { Providers } from "./providers"
import { CookieConsentLazy } from "@/components/cookie-consent-lazy"
import { ACCENT_SCRIPT } from "@/lib/accent"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--nf-sans",
  display: "swap",
})

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--nf-display",
  display: "swap",
  axes: ["opsz"],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--nf-mono",
  display: "swap",
  preload: false,
})

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--nf-reading",
  display: "swap",
  preload: false,
})

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  title: "Nib — Adaptive publishing for serious creators",
  description:
    "Adaptive publishing for serious creators. Write once, publish as article, summary, lesson, debate, or bundle — from one structured source.",
  authors: [{ name: "Nib" }],
  openGraph: {
    siteName: "Nib",
    type: "website",
  },
  twitter: {
    card: "summary",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} ${sourceSerif.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: ACCENT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
        <CookieConsentLazy />
        <Toaster richColors closeButton />
      </body>
    </html>
  )
}

import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // No htmlLimitedBots override: Next's default bot list (Googlebot, Bingbot, LinkedInBot, WhatsApp,
  // Chrome-Lighthouse...) already gets blocking metadata; everyone else streams it (no TTFB cost).
  // Lighthouse 12 no longer sends "Chrome-Lighthouse", so scripts/lighthouse-audit.mjs adds it to its UA.
  // Image optimization for common providers
  images: {
    // Local images: no query strings, except /blog/** where the seed appends ?v=<content hash>
    // so overwritten screenshots get a fresh optimizer cache key.
    // ponytail: any ?v on /blog/** is accepted; localPatterns.search is exact-match only, so a per-file hash can't be pinned here.
    localPatterns: [{ pathname: "/blog/**" }, { pathname: "/**", search: "" }],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ywaqihuivcsdfugeibga.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      // Local Supabase storage (dev only) — so locally uploaded/rehosted
      // post-media renders. No such host exists in prod.
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            // microphone=(self): composer voice dictation; no third-party frames.
            value: "camera=(), microphone=(self), geolocation=()",
          },
        ],
      },
    ]
  },

  // Logging for server actions in dev
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  // Suppress noisy warnings during build
  typescript: {
    // Set to true only during initial development while stabilizing types.
    // Remove before true production launch.
    ignoreBuildErrors: false,
  },
}

export default nextConfig

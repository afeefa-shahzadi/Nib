// Single source for brand name, contact address and site URL.
export const BRAND_NAME = "Nib"
export const BRAND_TAGLINE = "Adaptive publishing for serious creators."
// Public contact address (not a secret); env overrides the default.
export const CONTACT_EMAIL = process.env.CONTACT_EMAIL ?? "writeson.nib@gmail.com"
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")

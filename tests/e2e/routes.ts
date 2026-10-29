// Every app/**/page.tsx route. Dynamic ones resolved with local seed data.
// Skipped on purpose: /dmca/counter/[noticeId] and /reset-password (need a valid
// token), /login/mfa (needs a pending MFA challenge).
export const PUBLIC_ROUTES = [
  "/", "/about", "/contact", "/docs", "/pricing", "/privacy", "/product", "/terms",
  "/login", "/signup", "/forgot-password",
  "/collections", "/dmca", "/earn", "/leaderboard", "/search",
  "/u/creator_demo", "/u/creator_demo/the-shape-of-attention", "/u/nib/welcome",
  "/org/demo-studio", "/collections/eeeeeeee-0000-0000-0000-000000000001",
]

export const READER_ROUTES = ["/feed", "/notifications", "/me/earnings"]

// The draft route is appended at runtime (first draft of test_studio).
export const AUTHOR_ROUTES = [
  "/studio", "/studio/analytics", "/studio/branches", "/studio/bundles", "/studio/collections",
  "/studio/debates", "/studio/drafts", "/studio/earnings", "/studio/graph", "/studio/leaderboard",
  "/studio/memberships", "/studio/network", "/studio/notifications", "/studio/org",
  "/studio/quests", "/studio/settings", "/studio/tiers",
]

export const ADMIN_ROUTES = ["/admin/moderation", "/admin/payouts", "/admin/waitlist"]

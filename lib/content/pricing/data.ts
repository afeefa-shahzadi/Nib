import { PAYOUT_MIN_INR, formatINRMarket, type CurrencyCode } from "@/lib/currency"
import type { Tier } from "@/lib/types/marketing"

/** Platform fee on tips/sponsorships for Free accounts, in percent. Marketing copy quotes this. */
export const TIP_PLATFORM_FEE_PCT = 10

export function getTiers(): Tier[] {
  return [
    {
      name: "Reader / Creator",
      priceRupees: 0,
      priceLabel: "Free",
      priceSub: "forever",
      blurb: "For everyday readers and new creators. Read, write, and earn from day one. No ads, ever.",
      features: [
        "Unlimited writing",
        "Branches, debate rooms, claps, saves, reposts",
        `Tips received (${TIP_PLATFORM_FEE_PCT}% platform fee)`,
        "Curated collections",
        "Sponsored Pieces (80% to author)",
        "Earn Insight Points & Daily Quests",
        "Creator payouts (after a 7-day clearing period)",
        "50,000 AI tokens/day (or unlimited BYOK)",
      ],
      cta: "Start free",
      ctaTo: "/signup",
      accent: false,
    },
    {
      name: "Reader Pass",
      priceRupees: 199,
      priceRupeesYearly: 165,
      priceSub: "per month",
      priceSubYearly: "per month, billed annually",
      discountBadge: "Save 17%",
      blurb: "For avid readers. 85% of your pass is shared monthly with the creators you clap for.",
      features: [
        "Includes all Free tier features",
        "85% of your pass funds creators you read",
        "2,500 bonus points monthly for quests & perks",
        "Transparent monthly pool statement",
        "Support your favorite creators",
      ],
      cta: "Get Reader Pass",
      ctaTo: "/signup?role=reader",
      accent: false,
    },
    {
      name: "Studio",
      priceRupees: 499,
      priceRupeesYearly: 415,
      priceSub: "per month",
      priceSubYearly: "per month, billed annually",
      discountBadge: "Save 17%",
      blurb: "For professional creators and independent studios. Sell at scale and cap your platform fees.",
      features: [
        "Everything in Free",
        "0% platform fee (up to ₹50k/mo GMV, then 5%)",
        "Advanced analytics & cohorts",
        "Block-level paid gating",
        "Full export (Markdown + JSON)",
        "Membership tiers (subscriptions)",
        "Unlimited AI usage via BYOK integration",
      ],
      cta: "Free during launch",
      ctaTo: "/studio/settings",
      accent: true,
    },
    {
      name: "Organizations",
      priceRupees: 399,
      priceRupeesYearly: 319,
      priceSub: "per seat / month",
      priceSubYearly: "per seat / month, billed annually",
      discountBadge: "Save 20%",
      blurb: "For organizations, newsrooms, and growing teams. Shared workspaces with a minimum of 3 seats.",
      features: [
        "Shared org workspace + slug",
        "Org-only debate rooms (private)",
        "Member roles (owner / admin / member)",
        "Consolidated billing & invites",
        "SSO-ready (on request)",
        "Priority support & onboarding",
        "All Studio perks for every seat",
      ],
      cta: "Create an org",
      ctaTo: "/studio/org",
      accent: false,
    },
    {
      name: "Enterprise",
      priceRupees: 999,
      priceRupeesYearly: 899,
      priceSub: "per seat / month",
      priceSubYearly: "per seat / month, billed annually",
      discountBadge: "Save 10%",
      blurb: "For large enterprises. Advanced compliance, SSO, and dedicated support for maximum scale.",
      features: [
        "SSO / SAML (provisioned per contract)",
        "Advanced audit logs",
        "Priority AI limits (1M tokens/day)",
        "Dedicated account manager",
        "Custom SLA and compliance",
        "All Organizations perks",
      ],
      cta: "Contact Sales",
      ctaTo: "/contact?intent=enterprise",
      accent: true,
    },
    {
      name: "Education",
      priceRupees: 50000,
      priceRupeesYearly: 50000,
      priceSub: "per year / site license",
      priceSubYearly: "per year / site license",
      blurb: "For educational institutions. Discounted annual campus license for up to 500 students and faculty.",
      features: [
        "Up to 500 student & faculty seats",
        "Campus SSO (on request)",
        "Private assignment tracking",
        "Internal-only publishing controls",
        "Dedicated onboarding support",
      ],
      cta: "Apply for Education",
      ctaTo: "/contact?intent=education",
      accent: false,
    },
  ]
}

export const COMPARE: Array<
  [
    string,
    boolean | string, // Anon
    boolean | string, // Free
    boolean | string, // Reader Pass
    boolean | string, // Studio
    boolean | string, // Org
    boolean | string, // Enterprise
    boolean | string, // Edu
  ]
> = [
  ["Publish unlimited pieces", false, true, true, true, true, true, true],
  ["Monthly bonus points", false, false, "2,500 pts", false, false, false, false],
  ["Claps, saves, reposts", false, true, true, true, true, true, true],
  ["Tips received", "—", "90%", "90%", "100% (up to ₹50k)", "100%", "100%", "100%"],
  ["Sponsored Pieces", false, true, true, true, true, true, true],
  ["Earn Insight Points (perks)", false, true, true, true, true, true, true],
  ["Block-level paid gating", false, false, false, true, true, true, true],
  ["Advanced analytics", false, false, false, true, true, true, true],
  ["Full export", false, false, false, true, true, true, true],
  ["Membership tiers", false, false, false, true, true, true, true],
  ["Org workspace + shared drafts", false, false, false, false, true, true, true],
  ["Org-only private rooms", false, false, false, false, true, true, true],
  ["Priority support & onboarding", false, false, false, false, true, true, true],
  ["SSO / SAML (on request)", false, false, false, false, false, true, true],
  ["Private assignment tracking", false, false, false, false, false, false, true],
  ["Multi-Provider AI (BYOK)", true, true, true, true, true, true, true],
]

export function getFAQ(code: CurrencyCode = "INR") {
  return [
    {
    q: "Are there ads, anywhere?",
    a: "No. Nib will never run display ads. We earn only through Studio subscriptions, Org seats, and a small platform fee on tips/sponsorships for Free accounts.",
  },
  {
    q: "How does the platform make money on Free accounts?",
    a: "10% fee on tips and sponsored pieces. Free accounts keep 90%. Studio accounts keep 100% up to ₹50,000 in monthly GMV, after which a 5% fee applies.",
  },
    {
      q: "What are Insight Points for?",
      a: "Insight Points are non-cashable status points earned from quests, streaks, and engagement. They power your leaderboard rank, level, and perks — they are not currency and don't convert to cash. Real earnings (tips, sponsorships and reader-pool shares) are what pay out.",
    },
    {
      q: "What's the payout minimum?",
      a: `${formatINRMarket(PAYOUT_MIN_INR, code)}. We set a floor so Razorpay processing fees don't eat your earnings. Balances accumulate until you cross it.`,
    },
  {
    q: "What's included in an Org plan?",
    a: "Every seat gets all Studio perks plus the shared workspace, private org-only debate rooms, and consolidated billing. Minimum 3 seats. The Enterprise tier adds SSO and priority limits.",
  },
  {
    q: "How does the Education site license work?",
    a: "Instead of paying per seat, educational institutions pay a flat ₹50,000 annual fee to cover all students and faculty on campus. Campus SSO integration is available on request.",
  },
  {
    q: "Can I switch between plans?",
    a: "Yes. Upgrade or downgrade anytime. Razorpay pro-rates the difference automatically.",
  },
  {
    q: "What about GST and invoices?",
    a: "Razorpay handles GST collection where applicable and issues monthly itemized invoices you can hand to your accountant.",
  },
  {
    q: "Are there limits on AI features?",
    a: "Free users share a daily allowance of 50,000 tokens. However, you can bring your own API keys (BYOK) for providers like OpenAI, Anthropic, Google, OpenRouter, or Mistral to bypass platform limits entirely.",
  },
]
}

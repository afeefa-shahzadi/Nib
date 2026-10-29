import { BRAND_NAME as BRAND } from "@/lib/brand"

export const FEATURE_BLOCKS = [
  {
    label: "Block model",
    title: "Every paragraph is a unit.",
    body: "Paragraphs, evidence, counter-arguments, citations, gates — each is a typed block with its own role, visibility, and monetization rules. Edit once. Render anywhere.",
  },
  {
    label: "Reading modes",
    title: "Five views of one piece.",
    body: "Skim, Standard, Expert, Teach, Debate. Each block declares which modes it appears in. Readers switch on demand — no extra writing.",
  },
  {
    label: "Branches",
    title: "Counter-arguments without dilution.",
    body: "Branches are first-class siblings of the canonical piece. Translation, audio, expansion, response — all live next to the original without polluting it.",
  },
  {
    label: "Bundles",
    title: "Outcome-shaped products.",
    body: "Group pieces and branches into courses, dossiers, or playbooks. Sell, gift, or gate them. Bundles are nouns in the system, not folder names.",
  },
  {
    label: "Debates",
    title: "Structured disagreement.",
    body: "Turn a contested claim into a thread. Invite responses. Surface the strongest counter — not the loudest one. Reputation flows from rigor.",
  },
  {
    label: "Archive",
    title: "Old ideas, alive.",
    body: "Every block is addressable, taggable, citable. The composer surfaces related past work as you write. Your archive becomes intelligence, not storage.",
  },
  {
    label: "Composer",
    title: "A bespoke editor.",
    body: "Slash menu summons typed blocks. Inspector shows mode visibility, semantic role, monetization eligibility. AI variants generate alongside, never overwriting.",
  },
  {
    label: "Sovereignty",
    title: "Your audience is yours.",
    body: "Direct payments. No algorithm between you and the readers you earned.",
  },
  {
    label: "BYOK AI",
    title: "Bring Your Own Key.",
    body: "Plug in your API keys for OpenAI, Anthropic, Google, Mistral, OpenRouter, Ollama, or NVIDIA. Bypass platform limits, pay only for what you generate, and retain total control.",
  },
]

export const STEPS = [
  {
    n: "01",
    title: "Draft once in the composer.",
    body: "Type prose, drop in evidence, mark a paragraph as a thesis or a gated block. Every keystroke autosaves.",
  },
  {
    n: "02",
    title: "Set per-block visibility.",
    body: "Decide which blocks appear in Skim, which in Expert, which in Teach. The inspector makes it a checkbox, not a chore.",
  },
  {
    n: "03",
    title: "Generate or write variants.",
    body: "Use the AI variant tray to draft a 60-word summary or a teaching reframe — stored as siblings, applied on approval.",
  },
  {
    n: "04",
    title: "Publish + branch.",
    body: "Open it to readers. Add branches (audio version, response, deep-dive) as the conversation evolves.",
  },
  {
    n: "05",
    title: "Bundle + monetize.",
    body: "Group pieces into a paid bundle, attach a membership tier, or open a tip jar. Get paid directly.",
  },
]

export const FAQ = [
  {
    q: "Is this a Substack alternative?",
    a: "It overlaps — email, payments, audience — but Nib treats a piece as a structured object, not a newsletter issue. If you publish ideas (not just dispatches), the model fits.",
  },
  {
    q: "Do I need to learn a new format?",
    a: "No. The composer reads like a normal editor. Mode visibility and semantic roles are optional layers — turn them on per block when you want them.",
  },
  {
    q: "Can readers really tell the difference?",
    a: "Yes. Switching modes changes which blocks render. A Skim view of a 4,000-word essay is genuinely 400 words — not collapsed, deleted.",
  },
  {
    q: "How does monetization work?",
    a: "Bundles, membership tiers, gated blocks, and a tip jar. Direct payments. Platform fee on paid features only — free to write.",
  },
]

// Passages from the official welcome post (scripts/seed_official_blog.ts), shown in the home hero.
export const EXCERPT = {
  href: "/u/nib/welcome",
  title: `Welcome to ${BRAND}`,
  paragraphs: [
    `${BRAND} is a place to publish writing that can change shape for its reader. You write a piece once, as a sequence of blocks: paragraphs, claims, evidence, code, charts, exercises, diagrams.`,
    "Readers then choose how they want to read it. Someone in a hurry can skim the headline claims. A specialist can switch to Expert for the precise detail and the evidence. A student can read the Teach version, with the scaffolding left in.",
  ],
  thesis: "One piece, several ways in.",
  skim: [
    "You write a piece once, as a sequence of blocks.",
    "Readers pick Skim, Standard, Expert, Teach or Debate.",
    "Writers decide which blocks appear in which mode.",
  ],
  expertHtml:
    "Every piece can be read in Skim, Standard, Expert, Teach or Debate mode. Writers decide which blocks appear in which mode, and can write a separate version of a block for a mode.<sup>[1]</sup> Thesis, Evidence, Counter and Footnote are block types, not formatting.<sup>[2]</sup>",
  notes: [
    { title: "The complete composer guide", href: "/u/nib/composer-guide" },
    { title: "Getting started on Nib", href: "/u/nib/getting-started" },
  ],
  question: "A reader has two minutes before a meeting. Which mode shows them the headline claims?",
}

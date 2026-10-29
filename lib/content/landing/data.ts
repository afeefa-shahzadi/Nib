import { BRAND_NAME as BRAND } from "@/lib/brand"

export const FEATURE_BLOCKS = [
  {
    label: "Blocks",
    title: "Every paragraph has a job.",
    body: "Mark a paragraph as a claim, evidence, a counter-argument, a citation or a supporters-only section. Readers and search see the structure.",
  },
  {
    label: "Reading modes",
    title: "Five views of one piece.",
    body: "Skim, Standard, Expert, Teach and Debate. You choose which blocks appear in each, and readers switch whenever they like.",
  },
  {
    label: "Branches",
    title: "Follow-ups that stay attached.",
    body: "Add a translation, an audio version, a deeper dive or a reply to a critic. Each one sits beside the original piece.",
  },
  {
    label: "Bundles",
    title: "Sell a course or a reading list.",
    body: "Group pieces into a bundle, then sell it, gift it or keep it for members.",
  },
  {
    label: "Debates",
    title: "Disagreement with structure.",
    body: "Open a contested claim to responses. Readers vote up the strongest counter-argument, and the best replies rise.",
  },
  {
    label: "Your own AI key",
    title: "Optional, and yours.",
    body: "Connect OpenAI, Anthropic, Google, Mistral, OpenRouter, Ollama or NVIDIA to draft summaries and teaching versions. You pay the provider directly.",
  },
]

export const STEPS = [
  {
    n: "1",
    title: "Write in the composer.",
    body: "It works like any editor. Everything autosaves.",
  },
  {
    n: "2",
    title: "Choose what each mode shows.",
    body: "Tick which blocks appear in Skim, Expert or Teach. Skip this and every mode shows the whole piece.",
  },
  {
    n: "3",
    title: "Publish, then keep going.",
    body: "Add branches as readers respond, or bundle pieces and turn on tips and memberships.",
  },
]

export const FAQ = [
  {
    q: "Is this a Substack alternative?",
    a: "Partly. Nib has email, payments and followers too. The difference is the piece itself: it's built from blocks, so readers can choose how much of it to read.",
  },
  {
    q: "Do I need to learn a new format?",
    a: "No. The composer works like a normal editor. Modes and block roles are extras you can ignore.",
  },
  {
    q: "Can readers really tell the difference?",
    a: "Yes. A Skim view of a 4,000-word essay can be 400 words, because only the blocks you marked for Skim are shown.",
  },
  {
    q: "How does monetization work?",
    a: "Bundles, memberships, supporters-only blocks and tips, paid to you directly. Writing and reading are free; a fee applies only to paid features.",
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
  counter:
    "Objection: writers already struggle to finish one version. Answer: you still write one. Modes choose which of your blocks to show; extra versions are optional.",
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

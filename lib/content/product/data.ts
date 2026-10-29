 
import {
  Layers,
  GitBranch,
  Package,
  Library,
  MessagesSquare,
  Workflow,
  Eye,
  Sparkles,
} from "lucide-react"

export const PILLARS = [
  {
    icon: Layers,
    label: "Block model",
    title: "Every paragraph is a typed unit.",
    body: "Twelve block primitives — paragraph, heading, citation, quote, code, callout, question, image, chart, exercise, audio, embed. Each declares its semantic role, mode visibility, monetization eligibility, and AI variants.",
    bullets: [
      "Drag-and-drop reordering with semantic constraints",
      "Heatmap overlay shows mode visibility at a glance",
      "Inspector pane for per-block metadata",
      "Block-level permalinks for citation",
    ],
  },
  {
    icon: Eye,
    label: "Reading modes",
    title: "Five views of the same source.",
    body: "Skim, Standard, Expert, Teach, Debate. The reader switches modes via a sticky toggle and the piece literally re-composes from the underlying blocks.",
    bullets: [
      "Skim: thesis + spine, ~10% of the piece",
      "Standard: clean reading-first flow",
      "Expert: evidence, citations, footnotes inline",
      "Teach: scaffolded with interactive prompts and self-checks",
      "Debate: contested claims surfaced with counter-arguments",
    ],
  },
  {
    icon: GitBranch,
    label: "Branches",
    title: "Counter-arguments without dilution.",
    body: "Branches are first-class siblings of a canonical piece. Audio versions, translations, expansions, rebuttals — each lives next to the original, discoverable but distinct.",
    bullets: [
      "Branch typing (response, expansion, translation, audio)",
      "Author or community branches with attribution",
      "Cross-branch citation tracking",
      "Premium branches gated to bundles or tiers",
    ],
  },
  {
    icon: Package,
    label: "Bundles",
    title: "Outcome-shaped products.",
    body: "Group pieces and branches into courses, dossiers, or playbooks. Sell as one-time purchases, attach to membership tiers, or hand to students.",
    bullets: [
      "Ordered curriculum or open library layouts",
      "Mixed gating (some items free, some paid)",
      "Direct payments",
      "Progress tracking for buyers",
    ],
  },
  {
    icon: MessagesSquare,
    label: "Debates",
    title: "Structured disagreement.",
    body: "Convert any claim block into a debate. Readers post responses tagged to specific blocks. The strongest counter — measured by citations and engagement — surfaces first.",
    bullets: [
      "Block-anchored threading",
      "Surface the strongest counter-arguments",
      "Author-moderated synthesis",
      "Debates can be branched into a new piece",
    ],
  },
  {
    icon: Library,
    label: "Archive",
    title: "Your past work, alive.",
    body: "Every block you've ever written is addressable, taggable, and surfaced contextually as you write new pieces. The composer treats your archive as working memory.",
    bullets: [
      "Semantic search across all blocks",
      "Inline `[[` to link to past pieces or blocks",
      "Citation graph between your own work",
      "Reuse blocks across pieces via citations",
    ],
  },
  {
    icon: Workflow,
    label: "Composer",
    title: "A bespoke editor for structured writing.",
    body: "Three-pane workspace: outline navigator, canvas with mode strip, and inspector for block metadata. Each block is an isolated semantic unit with its own rich text editor, mode visibility flags, and metadata — not a monolithic document.",
    bullets: [
      "Semantic block array with per-block Tiptap rich text",
      "Slash menu (/) and inline shortcuts ([[, @)",
      "AI variant tray per block — preview, accept, discard",
      "Mode visibility heatmap overlay",
    ],
  },
  {
    icon: Sparkles,
    label: "AI variants",
    title: "Generation alongside, never overwriting.",
    body: "Ask the AI to draft a Skim summary, a teaching reframe, or a counter-argument for any block. Variants are stored as siblings; you choose which to promote into the live piece.",
    bullets: [
      "Per-block generation with mode-aware prompts",
      "Side-by-side diff before accepting",
      "Variant history retained",
    ],
  },
]

 
import {
  BookOpen,
  Layers,
  Eye,
  GitBranch,
  Package,
  MessagesSquare,
  Workflow,
  Sparkles,
  CreditCard,
  Shield,
  ChevronRight,
  Keyboard,
  ArrowLeftRight,
} from "lucide-react"
import type { ModeId, DemoBlock } from "@/lib/types/marketing"
import { KIND_META } from "@/lib/types/composer"
import { ORDER as SLASH_ORDER } from "@/components/composer/slash-menu"

export const MODES: { id: ModeId; name: string; hint: string }[] = [
  { id: "skim", name: "Skim", hint: "Spine only — ~10% of the piece." },
  { id: "standard", name: "Standard", hint: "Default reading flow." },
  { id: "expert", name: "Expert", hint: "Evidence + citations inline." },
  { id: "teach", name: "Teach", hint: "Scaffolded for learners." },
  { id: "debate", name: "Debate", hint: "Contested claims surfaced." },
]

export const DEMO_PIECE: DemoBlock[] = [
  {
    id: "1",
    kind: "thesis",
    text: "The article is a 19th-century artifact. Adaptive blocks replace it.",
    modes: ["skim", "standard", "expert", "teach", "debate"],
  },
  {
    id: "2",
    kind: "para",
    text: "For two centuries, publishing meant pouring an idea into a fixed shape. The internet multiplied the shapes but kept the model.",
    modes: ["standard", "expert", "teach"],
  },
  {
    id: "3",
    kind: "evidence",
    text: "Example evidence block: a sourced figure or study that backs the thesis, shown only to Expert readers.",
    modes: ["expert"],
  },
  {
    id: "4",
    kind: "citation",
    text: "See Anderson (2019) on archive retrieval cost and Sengupta (2022) on audience segmentation.",
    modes: ["expert"],
  },
  {
    id: "5",
    kind: "callout",
    text: "Try it yourself: open any past essay and ask which sentences a skimmer would keep.",
    modes: ["teach"],
  },
  {
    id: "6",
    kind: "counter",
    text: "Critics argue mode-switching fragments authorial voice. We think the opposite — voice survives, format adapts.",
    modes: ["debate", "expert"],
  },
  {
    id: "7",
    kind: "para",
    text: "Nib operationalizes this with typed blocks, per-mode visibility, and a composer that treats structure as first-class.",
    modes: ["skim", "standard", "expert", "teach", "debate"],
  },
]

export const SECTIONS = [
  {
    id: "intro",
    label: "Introduction",
    icon: BookOpen,
    keywords: "quickstart start getting started overview welcome",
  },
  {
    id: "concepts",
    label: "Core concepts",
    icon: Layers,
    keywords: "piece block branch bundle vocabulary nouns model",
  },
  {
    id: "composer",
    label: "The composer",
    icon: Workflow,
    keywords: "editor write slash menu tiptap shortcuts block builder",
  },
  {
    id: "reference",
    label: "Editor reference",
    icon: Keyboard,
    keywords:
      "slash commands block types markdown shortcuts keyboard hotkeys mention wiki link citation embed youtube loom vimeo code run mermaid chart exercise quiz poll audio video image heading versions history schedule meta seo prose only made with ai label dictation voice email newsletter heatmap minimap preview archive",
  },
  {
    id: "modes",
    label: "Reading modes",
    icon: Eye,
    keywords: "skim standard expert teach debate adaptive visibility mode demo",
  },
  {
    id: "branches",
    label: "Branches",
    icon: GitBranch,
    keywords: "audio teaching premium debate localized translation sibling",
  },
  {
    id: "bundles",
    label: "Bundles & collections",
    icon: Package,
    keywords: "bundle collection course reading list product price curation",
  },
  {
    id: "debates",
    label: "Debates",
    icon: MessagesSquare,
    keywords: "argument counter discussion room invite members claim response",
  },
  {
    id: "ai",
    label: "AI & BYOK",
    icon: Sparkles,
    keywords:
      "ai generation rewrite variant draft skim teach reframe meta summary tags themes links byok bring your own key openai anthropic mistral google gemini openrouter nvidia",
  },
  {
    id: "monetization",
    label: "Monetization",
    icon: CreditCard,
    keywords:
      "money revenue tip jar gated members tiers membership sponsor payout razorpay launch free",
  },
  {
    id: "import",
    label: "Import, export & feeds",
    icon: ArrowLeftRight,
    keywords:
      "import substack medium markdown url migrate scene break export zip json csv rss feed.xml llms.txt sitemap",
  },
  {
    id: "privacy",
    label: "Privacy & sovereignty",
    icon: Shield,
    keywords: "export data ownership audience email subscribers delete",
  },
  {
    id: "faq",
    label: "FAQ",
    icon: ChevronRight,
    keywords: "questions answers import substack medium wordpress offline seo",
  },
]

export const CONCEPTS = [
  {
    k: "Piece",
    v: "The canonical unit. A self-contained argument, essay, or explainer. Has an author, a slug, a status.",
  },
  {
    k: "Block",
    v: "A typed unit of content inside a piece. Every paragraph is one. So is a citation, a thesis, a gated section.",
  },
  {
    k: "Branch",
    v: "A labelled companion to a piece — audio, teaching, premium, debate, or localized — with its own purpose, summary, and visibility. Listed beside the piece for readers.",
  },
  {
    k: "Bundle",
    v: "An ordered set of your pieces with a title, an outcome, and a price in ₹ (₹0 for free).",
  },
]

export const BUNDLE_TYPES = [
  {
    t: "Bundle",
    s: "Studio → Bundles. Title, price in ₹, the outcome a reader gets, and an ordered list of your pieces.",
  },
  {
    t: "AI curation",
    s: "Type a topic and AI suggests which of your published pieces belong in the bundle. You choose what goes in.",
  },
  {
    t: "Collection",
    s: "Studio → Collections. A free, public reading list at /collections/<id>. Readers tick pieces off as they read; progress is saved in their browser.",
  },
]

export const PRIVACY_POINTS = [
  "Your follower list (ID, display name, handle, follow date) is exportable as CSV. Email addresses are not included — your readers' inbox belongs to them.",
  "Full data export from Studio → Settings → Data Export: a .zip with data.json (profile, pieces, blocks, branches) and one Markdown file per piece.",
  "No third-party trackers. No retargeting pixels. No sold audience data.",
  "Deleting your account (Studio → Settings) removes your pieces, bundles, membership tiers, and your login.",
]

// ---------- Editor reference ----------

// Straight from the composer's slash menu so the list can't drift.
export const SLASH_BLOCKS = SLASH_ORDER.map((k) => ({
  cmd: `/${k === "audio_note" ? "audio" : k}`,
  ...KIND_META[k],
}))

export const MARKDOWN_SHORTCUTS = [
  { type: "## + space", result: "Heading 2" },
  { type: "### + space", result: "Heading 3" },
  { type: "- or * + space", result: "Bulleted list" },
  { type: "1. + space", result: "Numbered list" },
  { type: "**bold**", result: "Bold" },
  { type: "*italic*", result: "Italic" },
  { type: "~~strike~~", result: "Strikethrough" },
  { type: "`code`", result: "Inline code" },
  { type: "==highlight==", result: "Highlight" },
  { type: "-- … -> (c)", result: "— … → ©" },
]

export const KEYBOARD_SHORTCUTS = [
  { keys: "Ctrl/⌘ + B / I / U", does: "Bold / italic / underline" },
  { keys: "Ctrl/⌘ + Shift + S", does: "Strikethrough" },
  { keys: "Ctrl/⌘ + E", does: "Inline code" },
  { keys: "Ctrl/⌘ + Shift + H", does: "Highlight" },
  { keys: "Ctrl/⌘ + Shift + 8 / 7", does: "Bulleted / numbered list" },
  { keys: "Ctrl/⌘ + Alt + 2 / 3", does: "Heading 2 / 3" },
  { keys: "Ctrl/⌘ + Z", does: "Undo typing (toolbar arrows undo block moves)" },
  { keys: "Ctrl/⌘ + S", does: "Save now (autosave also runs ~3 s after you stop)" },
  { keys: "Ctrl/⌘ + Enter", does: "Publish / unpublish" },
  { keys: "↑ ↓ Enter Esc", does: "Navigate the slash and mention menus" },
]

export const INLINE_TRIGGERS = [
  {
    k: "/",
    v: "At the start of a block or after a space. Keep typing to filter — /code, /mermaid, /video. In an empty block the pick replaces it; otherwise the new block goes below.",
  },
  {
    k: "@",
    v: "Mention a person. Type at least one letter of their handle, pick them, and a link to their profile is inserted.",
  },
  {
    k: "[[",
    v: "Link to one of your own pieces (drafts included). Type part of the title and pick it.",
  },
  {
    k: "Select text",
    v: "A bubble toolbar appears: bold, italic, strike, code, highlight, link, and the quote icon for a numbered inline citation [1].",
  },
]

export const BLOCK_NOTES = [
  {
    k: "Embed",
    v: "Paste a URL. YouTube (youtube.com/watch?v=… or youtu.be/…), Loom (loom.com/share/…), and Vimeo (vimeo.com/<number>) links are converted to their players. Any other URL is framed as-is, so it must allow embedding.",
  },
  {
    k: "Code",
    v: "Tabs for multiple files, a language picker, and auto-format on blur. Python, JavaScript, TypeScript, Go, C, C++, Java, Ruby, SQL (SQLite) and PostgreSQL get a Run button; HTML and CSS get a live Preview. Code runs in the reader's browser, so anyone can run it, and signed-in readers can edit their own copy without saving it. The ⓘ button on a block opens the code blocks guide (/u/nib/code-blocks).",
  },
  {
    k: "Mermaid",
    v: "Write Mermaid syntax, e.g. graph TD; A-->B; — readers see the rendered diagram (check it with Preview). Prefer drag-and-drop nodes? Use /flowchart.",
  },
  {
    k: "Chart",
    v: "Bar, line, area, pie, radar, scatter, or composed. Edit labels and series values in place.",
  },
  {
    k: "Exercise",
    v: "Short answer, multiple choice, multi-select, fill in the blanks (write ___ for each blank), poll, or matching. Readers answer, then reveal your solution.",
  },
  {
    k: "Image · Audio / Video",
    v: "Drop a file or paste a URL. Images up to 8 MB with alt text, caption, and credit; audio up to 25 MB, video up to 200 MB, with an optional transcript.",
  },
]

export const COMPOSER_TOOLS = [
  {
    k: "Prose only",
    v: "Meta → Prose only. For fiction, essays and anything you don't split into modes: hides the reading-mode dots and AI-variant buttons on every block while you write. Saved per piece; turn it off any time.",
  },
  {
    k: "Made with AI",
    v: "Meta → Made with AI. Shows readers a label in the piece header. Use it when AI wrote a substantial part of the text.",
  },
  {
    k: "Meta",
    v: "Summary (up to 160 characters), thesis, tags, tips, sponsors, repost credit, NSFW, Made with AI, Prose only, inline comments. The AI button drafts summary, thesis, and tags for you to edit.",
  },
  {
    k: "Schedule",
    v: "Pick a future date and time. The piece publishes automatically within about five minutes of it.",
  },
  {
    k: "Versions",
    v: "Outline pane → history. A snapshot is saved every 10 minutes while you edit, and Save Version adds one with your own message. Compare a version with the one before it, or restore it.",
  },
  {
    k: "Preview · Modes · Heatmap · Minimap",
    v: "See the piece as a reader; pick a reading mode to dim the blocks it hides; tint every block by the modes it appears in; or open a map of the whole piece.",
  },
  {
    k: "Archive · Synthesis",
    v: "Search your earlier blocks and drop one in as a citation or pulled quote. Synthesis scores how central each block is to the piece's theme and suggests links to your past work.",
  },
  {
    k: "Voice dictation",
    v: "The mic button bottom-right. Speak a phrase and it lands as a new paragraph below the current block. Needs a browser with speech recognition (Chrome, Edge, Safari).",
  },
  {
    k: "Send via Email",
    v: "In the ⋯ menu once published: emails the piece to every follower and subscriber with an email on file. It can't be unsent.",
  },
]

export const IMPORT_EXPORT = [
  {
    k: "Markdown",
    v: "Studio → Drafts → Import markdown. Paste text or load a .md file. Separate blocks with a blank line: # headings, > quotes, and ``` fenced code (with a language, e.g. ```python) become their own blocks; everything else becomes paragraphs. Bold, italic, inline code and links keep their formatting, and a --- or *** line becomes a * * * scene break. Images aren't imported from Markdown; add them afterwards with /image.",
  },
  {
    k: "Substack · Medium",
    v: "Studio → Drafts → Import from Substack/Medium. Upload the export .zip (up to 25 MB, 200 posts) — Substack: Settings → Exports; Medium: Settings → Download your information. Each post becomes a draft and images are re-hosted.",
  },
  {
    k: "Single URL",
    v: "Same dialog: paste one article URL, e.g. https://author.substack.com/p/my-post. Medium blocks server fetches, so use its .zip instead. Imported pieces keep the original URL as their canonical link.",
  },
  {
    k: "Export",
    v: "Studio → Settings → Data Export: the full .zip, plus a subscribers CSV.",
  },
  {
    k: "/feed.xml",
    v: "RSS 2.0 feed of the 50 latest public pieces.",
  },
  {
    k: "/sitemap.xml · /llms.txt",
    v: "Every public piece for search engines, and a plain-text guide for AI answer engines.",
  },
]

export const FAQ_ITEMS = [
  {
    q: "Do I have to use all five reading modes?",
    a: "No. Default to Standard. Turn on Skim or Expert per piece when the structure benefits. Teach and Debate are situational.",
  },
  {
    q: "Do I need a paid plan?",
    a: "Not during launch. Every feature, including the ones that will later be part of paid plans, is free for everyone while we launch.",
  },
  {
    q: "Can I import from Substack / Medium / WordPress?",
    a: "Substack and Medium: yes — upload their export .zip, or paste a single post URL. WordPress and other blogs: paste a post URL, or paste the text as Markdown. See Import, export & feeds above.",
  },
  {
    q: "Does Nib send the emails?",
    a: "Yes — once a piece is published, use ⋯ → Send via Email in the composer to send it to your followers and subscribers. Your follower list is exportable anytime.",
  },
  {
    q: "Do you support collaborators?",
    a: "Not yet. Co-authoring is on the roadmap. Today, one piece has one author of record.",
  },
  {
    q: "Is the editor offline-capable?",
    a: "Partly. Autosave runs about 3 seconds after you stop typing, and a version snapshot is committed every 10 minutes. If you go offline, keep the tab open — your edits stay in it and save when you reconnect.",
  },
  {
    q: "Can I run Nib on my own server?",
    a: "Not today. The platform is hosted. Export ensures you can leave; self-hosting is a 2027 question.",
  },
  {
    q: "How does AI generation respect my voice?",
    a: "It rewrites only the block you pick, and nothing changes until you review the result and click Apply. Discard throws it away.",
  },
  {
    q: "What about SEO?",
    a: "Every piece gets a clean URL (/u/<handle>/<slug>), metadata, JSON-LD, OG tags, and a sitemap entry. Modes don't fragment SEO — ?mode= links share one canonical URL. Imported pieces point their canonical at the original post.",
  },
  {
    q: "What are Insight Points for?",
    a: "Insight Points are non-cashable status points earned from quests and streak milestones. They drive your rank, level, and perks — they are not currency and don't convert to cash. Your withdrawable balance comes only from real earnings (tips, sponsorships, pool shares).",
  },
  {
    q: "What's the payout threshold?",
    a: "₹400 minimum per payout. This floor keeps Razorpay processing fees proportional; balances roll over until you cross it. 1% TDS is withheld from each payout.",
  },
  {
    q: "Can I see prices in my currency?",
    a: "Yes. Use the Currency dropdown on the Pricing, Earn, and Leaderboard pages — we guess from your time zone on first visit and remember your choice. Display only; billing always runs in INR via Razorpay.",
  },
]

export const DEBATE_INITIAL_RESPONSES = [
  {
    id: 1,
    author: "Mira K.",
    text: "Mode-switching does fragment voice if the author defaults to AI variants. Discipline matters.",
  },
  {
    id: 2,
    author: "Arjun D.",
    text: "Disagree — voice is in claim selection and tone, not paragraph count. The skimmer still hears the author.",
  },
]

export const BLOCK_BUILDER_KINDS = [
  "paragraph",
  "thesis",
  "evidence",
  "counter",
  "citation",
  "callout",
  "gated",
  "code",
  "question",
  "footnote",
  "image",
  "embed",
] as const

export const BLOCK_BUILDER_DEFAULTS = {
  kind: "paragraph" as (typeof BLOCK_BUILDER_KINDS)[number],
  text: "AI is rewriting publishing — adaptive blocks are the new primitive.",
  modes: {
    skim: true,
    standard: true,
    expert: true,
    teach: false,
    debate: false,
  },
}

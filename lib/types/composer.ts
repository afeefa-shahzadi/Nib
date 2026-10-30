/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────────────────────
// Composer types — block model, encoding/decoding, and metadata
// Previously at components/composer/types.ts
// ─────────────────────────────────────────────────────────────────────────────

export type ReadingMode = "skim" | "standard" | "expert" | "teach" | "debate"

export const MODES: ReadingMode[] = [
  "skim",
  "standard",
  "expert",
  "teach",
  "debate",
]

export const MODE_LABEL: Record<ReadingMode, string> = {
  skim: "Skim",
  standard: "Standard",
  expert: "Expert",
  teach: "Teach",
  debate: "Counterpoints",
}

// Persisted block types (matches DB enum)
export const DB_BLOCK_TYPES = [
  "paragraph",
  "heading",
  "quote",
  "callout",
  "code",
  "citation",
  "question",
  "image",
  "chart",
  "mermaid",
  "exercise",
  "audio_note",
  "embed",
  "flowchart",
] as const
export type DbBlockType = (typeof DB_BLOCK_TYPES)[number]

// Display-only "kinds" stored as (db type + semantic_role/monetization)
export type BlockKind =
  | DbBlockType
  | "thesis"
  | "evidence"
  | "counter"
  | "footnote"
  | "gated"

export const KIND_TO_DB: Record<BlockKind, DbBlockType> = {
  paragraph: "paragraph",
  heading: "heading",
  quote: "quote",
  callout: "callout",
  code: "code",
  citation: "citation",
  question: "question",
  image: "image",
  chart: "chart",
  mermaid: "mermaid",
  exercise: "exercise",
  audio_note: "audio_note",
  embed: "embed",
  flowchart: "flowchart",
  thesis: "paragraph",
  evidence: "paragraph",
  counter: "paragraph",
  footnote: "paragraph",
  gated: "paragraph",
}

export interface ChartSeries {
  label: string
  data: number[]
}

export interface BlockDraft {
  /** Local-only key; do not persist. */
  uid: string
  /** DB id if loaded from server. */
  id?: string
  kind: BlockKind
  content: {
    text: string
    html?: string
    // heading level (2 or 3); default 2
    level?: number
    // citation
    source?: string
    url?: string
    label?: string
    quote?: string
    page?: string
    // code
    lang?: string
    files?: { name: string; content: string; lang?: string }[]
    // image
    imageUrl?: string
    alt?: string
    caption?: string
    credit?: string
    creditUrl?: string
    // chart
    chartType?:
      | "bar"
      | "line"
      | "area"
      | "pie"
      | "radar"
      | "scatter"
      | "composed"
    labels?: string[]
    series?: ChartSeries[]
    // mermaid
    mermaidCode?: string
    // exercise
    exerciseType?:
      | "short_answer"
      | "multiple_choice"
      | "multi_select"
      | "fill_in_the_blanks"
      | "poll"
      | "matching"
    prompt?: string
    answer?: string
    hint?: string
    options?: {
      id?: string
      text: string
      isCorrect?: boolean
      pairText?: string
    }[]
    // audio_note
    audioUrl?: string
    transcript?: string
    // flowchart
    nodes?: Record<string, unknown>[]
    edges?: Record<string, unknown>[]
    duration?: number
    // embed
    embedUrl?: string
    embedTitle?: string
    // ai variants per mode
    aiVariants?: Partial<Record<ReadingMode, Partial<Omit<BlockDraft["content"], "aiVariants">>>>
  }
  // custom label for outline pane
  outlineLabel?: string | null
  semanticRole: string | null
  modeVisibility: Record<ReadingMode, boolean>
  monetizationEligible: boolean
  isNsfw: boolean
}

export const defaultVisibility = (): Record<ReadingMode, boolean> => ({
  skim: true,
  standard: true,
  expert: true,
  teach: true,
  debate: true,
})

let uidCounter = 0
export const newUid = () => `b_${Date.now().toString(36)}_${++uidCounter}`

export function makeBlock(
  kind: BlockKind,
  init: Partial<BlockDraft["content"]> = {}
): BlockDraft {
  const semantic =
    kind === "thesis" ||
    kind === "evidence" ||
    kind === "counter" ||
    kind === "footnote"
      ? kind
      : null
  const base: BlockDraft["content"] = { text: "", html: "", ...init }
  if (kind === "chart" && !base.series) {
    base.chartType = base.chartType ?? "bar"
    base.labels = base.labels ?? ["A", "B", "C", "D"]
    base.series = base.series ?? [{ label: "Series 1", data: [4, 7, 2, 5] }]
  }
  return {
    uid: newUid(),
    kind,
    content: base,
    semanticRole: semantic,
    modeVisibility: defaultVisibility(),
    monetizationEligible: kind === "gated",
    isNsfw: false,
  }
}

export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Decode a DB block row into a BlockDraft. */
export function decodeBlock(row: {
  id: string
  type: string
  content: unknown
  semantic_role: string | null
  mode_visibility: unknown
  monetization_eligible: boolean
  is_nsfw?: boolean | null
}): BlockDraft {
  const c = (row.content ?? {}) as Record<string, unknown>
  const sv = (row.mode_visibility ?? {}) as Record<string, unknown>
  const visibility: Record<ReadingMode, boolean> = {
    skim: sv.skim !== false,
    standard: sv.standard !== false,
    expert: sv.expert !== false,
    teach: sv.teach !== false,
    debate: sv.debate !== false,
  }
  let kind: BlockKind = (row.type as BlockKind) ?? "paragraph"
  if (row.type === "paragraph" && row.semantic_role) {
    if (
      ["thesis", "evidence", "counter", "footnote"].includes(row.semantic_role)
    ) {
      kind = row.semantic_role as BlockKind
    }
  }
  if (
    row.type === "paragraph" &&
    row.monetization_eligible &&
    !row.semantic_role
  ) {
    kind = "gated"
  }
  return {
    // Fix #11: reuse the server id as uid so React's key stays stable across
    // realtime refetches. Falls back to a new uid only for uncommitted rows.
    uid: row.id ?? newUid(),
    id: row.id,
    kind,
    content: {
      text: typeof c.text === "string" ? c.text : "",
      html: typeof c.html === "string" ? c.html : "",
      level: typeof c.level === "number" ? c.level : undefined,
      source: typeof c.source === "string" ? c.source : undefined,
      url: typeof c.url === "string" ? c.url : undefined,
      label: typeof c.label === "string" ? c.label : undefined,
      quote: typeof c.quote === "string" ? c.quote : undefined,
      page: typeof c.page === "string" ? c.page : undefined,
      lang: typeof c.lang === "string" ? c.lang : undefined,
      files: Array.isArray(c.files) ? (c.files as { name: string; content: string; lang?: string }[]) : undefined,
      imageUrl: typeof c.imageUrl === "string" ? c.imageUrl : undefined,
      alt: typeof c.alt === "string" ? c.alt : undefined,
      caption: typeof c.caption === "string" ? c.caption : undefined,
      credit: typeof c.credit === "string" ? c.credit : undefined,
      creditUrl: typeof c.creditUrl === "string" ? c.creditUrl : undefined,
      chartType: [
        "line",
        "bar",
        "area",
        "pie",
        "radar",
        "scatter",
        "composed",
      ].includes(c.chartType as string)
        ? (c.chartType as BlockDraft["content"]["chartType"])
        : undefined,
      labels: Array.isArray(c.labels)
        ? (c.labels as any[]).map(String)
        : undefined,
      series: Array.isArray(c.series) ? (c.series as ChartSeries[]) : undefined,
      mermaidCode:
        typeof c.mermaidCode === "string" ? c.mermaidCode : undefined,
      exerciseType:
        typeof c.exerciseType === "string"
          ? (c.exerciseType as BlockDraft["content"]["exerciseType"])
          : undefined,
      prompt: typeof c.prompt === "string" ? c.prompt : undefined,
      answer: typeof c.answer === "string" ? c.answer : undefined,
      hint: typeof c.hint === "string" ? c.hint : undefined,
      options: Array.isArray(c.options) ? (c.options as BlockDraft["content"]["options"]) : undefined,
      audioUrl: typeof c.audioUrl === "string" ? c.audioUrl : undefined,
      transcript: typeof c.transcript === "string" ? c.transcript : undefined,
      duration: typeof c.duration === "number" ? c.duration : undefined,
      embedUrl: typeof c.embedUrl === "string" ? c.embedUrl : undefined,
      embedTitle: typeof c.embedTitle === "string" ? c.embedTitle : undefined,
      nodes: Array.isArray(c.nodes) ? (c.nodes as Record<string, unknown>[]) : undefined,
      edges: Array.isArray(c.edges) ? (c.edges as Record<string, unknown>[]) : undefined,
      aiVariants: (c.aiVariants ??
        undefined) as BlockDraft["content"]["aiVariants"],
    },
    semanticRole: row.semantic_role,
    modeVisibility: visibility,
    monetizationEligible: row.monetization_eligible,
    isNsfw: !!row.is_nsfw,
    outlineLabel: (c as Record<string, unknown>).outlineLabel as string | undefined || null,
  }
}

/** Encode local block to the shape expected by saveBlocks server fn. */
export function encodeBlock(b: BlockDraft) {
  // Fix #15: filter out undefined values automatically so new content fields
  // don't require manual additions here.
  const content = Object.fromEntries(
    Object.entries(b.content).filter(([, v]) => v !== undefined)
  ) as BlockDraft["content"]
  
  if (b.outlineLabel) {
    (content as Record<string, unknown>).outlineLabel = b.outlineLabel;
  }

  return {
    id: b.id,
    type: KIND_TO_DB[b.kind],
    content,
    semantic_role: (["thesis", "evidence", "counter", "footnote"] as BlockKind[]).includes(
      b.kind
    )
      ? b.kind
      : b.semanticRole,
    mode_visibility: b.modeVisibility,
    monetization_eligible: b.monetizationEligible,
    is_nsfw: b.isNsfw,
  }
}

export const KIND_META: Record<
  BlockKind,
  { label: string; hint: string; icon: string }
> = {
  paragraph: { label: "Paragraph", hint: "Plain prose", icon: "¶" },
  heading: { label: "Heading", hint: "Section title", icon: "H" },
  image: { label: "Image", hint: "Picture with caption", icon: "▦" },
  quote: { label: "Quote", hint: "Pulled-out quote", icon: "❝" },
  callout: { label: "Callout", hint: "Highlighted note", icon: "★" },
  code: { label: "Code", hint: "Monospace block", icon: "{}" },
  citation: { label: "Citation", hint: "Source w/ link", icon: "§" },
  question: { label: "Question", hint: "Open question → debate", icon: "?" },
  chart: { label: "Chart", hint: "Data viz", icon: "▮" },
  mermaid: { label: "Mermaid", hint: "Flowchart / diagram", icon: "⎈" },
  flowchart: { label: "Flowchart", hint: "Interactive node graph", icon: "⎈" },
  exercise: { label: "Exercise", hint: "Prompt + reveal", icon: "✎" },
  audio_note: { label: "Audio / Video", hint: "Audio or video clip", icon: "♪" },
  embed: { label: "Embed", hint: "YouTube, Loom, Vimeo, or any URL", icon: "⊡" },
  thesis: { label: "Thesis", hint: "Core claim", icon: "◆" },
  evidence: { label: "Evidence", hint: "Supporting fact", icon: "✓" },
  counter: { label: "Counter", hint: "Strongest objection", icon: "↻" },
  footnote: { label: "Footnote", hint: "Aside / margin note", icon: "†" },
  gated: { label: "Gated", hint: "Supporters only", icon: "🔒" },
}

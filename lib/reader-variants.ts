type VariantBlock = { content: Record<string, unknown> }

// Per-mode variants are authored into content.aiVariants[mode] (a partial
// content patch). Overlay the active mode's patch on the block; standard mode,
// or a mode with no variant, reads the original block untouched.
export function resolveBlockForMode<B extends VariantBlock>(block: B, mode: string): B {
  if (mode === "standard") return block
  const variants = block.content.aiVariants as Record<string, Record<string, unknown>> | undefined
  const variant = variants?.[mode]
  if (!variant || Object.keys(variant).length === 0) return block
  const content = { ...block.content, ...variant }
  // The reader prefers html over text: a text-only variant must not be shadowed
  // by the standard version's stale html.
  if ("text" in variant && !("html" in variant)) content.html = ""
  return { ...block, content }
}

type ModeBlock = VariantBlock & { mode_visibility?: unknown }

export function isVisibleInMode(block: { mode_visibility?: unknown }, mode: string): boolean {
  const mv = block.mode_visibility
  if (!mv) return true
  if (Array.isArray(mv)) return (mv as string[]).includes(mode)
  if (typeof mv === "object") return (mv as Record<string, boolean>)[mode] !== false
  return true
}

const render = (blocks: ModeBlock[], mode: string) =>
  JSON.stringify(blocks.filter((b) => isVisibleInMode(b, mode)).map((b) => resolveBlockForMode(b, mode).content))

/** Modes (in the given order) whose rendered piece differs from Standard; Standard is always included. */
export function availableModes<M extends string>(blocks: ModeBlock[], modes: readonly M[]): M[] {
  const base = render(blocks, "standard")
  return modes.filter((m) => m === "standard" || render(blocks, m) !== base)
}

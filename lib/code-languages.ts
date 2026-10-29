// Single source of truth for which languages Piston can execute. The editor
// "Run" button (code-block-editor.tsx), the reader "Run" button (code-block.tsx)
// and the executeCode server action (actions/code.ts) all gate on this list, so
// they can't drift — a Run button offered for a language the server rejects is a
// dead promise (that's exactly how the PHP button got stranded). Aliases map the
// editor/file-extension spellings to Piston's canonical runtime id.

export const RUNNABLE_LANGUAGES = [
  "python",
  "javascript",
  "typescript",
  "rust",
  "go",
  "c",
  "cpp",
  "java",
  "ruby",
  "sqlite3",
] as const

export type RunnableLanguage = (typeof RUNNABLE_LANGUAGES)[number]

const ALIASES: Record<string, RunnableLanguage> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  "c++": "cpp",
  sql: "sqlite3",
}

/** Normalize an editor/file-ext language spelling to Piston's canonical id, or null if it can't run. */
export function canonicalRunLang(lang: string): RunnableLanguage | null {
  const l = lang.trim().toLowerCase()
  const mapped = (ALIASES[l] ?? l) as RunnableLanguage
  return (RUNNABLE_LANGUAGES as readonly string[]).includes(mapped) ? mapped : null
}

/** True when this language can be run via Piston. */
export function isRunnableLang(lang: string): boolean {
  return canonicalRunLang(lang) !== null
}

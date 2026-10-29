// Single source of truth for which languages can run. The editor "Run" button
// (code-block-editor.tsx), the reader "Run" button (code-block.tsx) and the
// runner (lib/run-code.ts) all gate on this list, so they can't drift — a Run
// button offered for a language the runner rejects is a dead promise (that's
// exactly how the PHP button got stranded). Aliases map the editor/file-extension
// spellings to one canonical id. Rust is left out: the in-browser runner has no
// Rust compiler.

export const RUNNABLE_LANGUAGES = [
  "python",
  "javascript",
  "typescript",
  "go",
  "c",
  "cpp",
  "java",
  "ruby",
  "sqlite3",
  "postgres",
] as const

export type RunnableLanguage = (typeof RUNNABLE_LANGUAGES)[number]

const ALIASES: Record<string, RunnableLanguage> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  "c++": "cpp",
  sql: "sqlite3",
  postgresql: "postgres",
  pg: "postgres",
}

/** Normalize an editor/file-ext language spelling to its canonical id, or null if it can't run. */
export function canonicalRunLang(lang: string): RunnableLanguage | null {
  const l = lang.trim().toLowerCase()
  const mapped = (ALIASES[l] ?? l) as RunnableLanguage
  return (RUNNABLE_LANGUAGES as readonly string[]).includes(mapped) ? mapped : null
}

/** True when this language can run. */
export function isRunnableLang(lang: string): boolean {
  return canonicalRunLang(lang) !== null
}

/** Prism grammar for a block language; PostgreSQL highlights as SQL. */
export function prismLang(lang?: string): string {
  const l = (lang || "text").toLowerCase()
  return l === "postgres" ? "sql" : l
}

/** Nib's guide to code blocks: multi-file setups, web pages, SQL and PostgreSQL. */
export const CODE_GUIDE_URL = "/u/nib/code-blocks"

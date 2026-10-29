"use client"

// Code blocks run in the reader's browser with sandrun: each language runtime
// is WebAssembly in a sandboxed iframe, so there is no execution server to
// deploy, scale or rate-limit, and signed-out readers can run code too. The
// Piston path in actions/code.ts stays in the tree but is no longer called.

import { useEffect, useMemo, useState, type RefObject } from "react"
import { createRunner, normalizeLanguage, selectEngine, type Engine, type Progress, type Runner } from "@browserrun/sandrun"
import { canonicalRunLang } from "@/lib/code-languages"

export interface CodeFile {
  name: string
  content: string
}

export interface RunOutcome {
  success: boolean
  output?: string
  error?: string
  code?: number | null
  signal?: string | null
}

const EXTENSIONS: Record<string, string> = {
  python: "py",
  javascript: "js",
  typescript: "ts",
  go: "go",
  c: "c",
  cpp: "cpp",
  java: "java",
  ruby: "rb",
  sqlite3: "sql",
  postgres: "sql",
}

let runner: Runner | null = null
const listeners = new Set<(progress: Progress) => void>()

function getRunner(): Runner {
  runner ??= createRunner({
    timeoutMs: 10_000,
    onProgress: (p) => listeners.forEach((fn) => fn(p)),
  })
  return runner
}

// Files are imported by name (`import helper`, `#include "util.h"`), so a
// name typed without an extension gets the language's one.
function named(lang: string, files: CodeFile[]): CodeFile[] {
  const ext = EXTENSIONS[lang]
  return files.map((f, i) => {
    const name = f.name.trim() || (i === 0 ? "main" : `file${i}`)
    return { name: /\.\w+$/.test(name) || !ext ? name : `${name}.${ext}`, content: f.content }
  })
}

/** The engine a run of these files will use, to match progress events to a button. */
export function engineFor(language: string, files: CodeFile[]): Engine | null {
  const lang = canonicalRunLang(language)
  const normalized = lang && normalizeLanguage(lang)
  if (!lang || !normalized) return null
  const list = named(lang, files)
  return selectEngine(normalized, list.map((f) => f.content).join("\n"), {}, list.map((f) => f.name))
}

/** Subscribe to runtime download progress. Returns the unsubscribe function. */
export function onRunProgress(fn: (progress: Progress) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Start loading a language's runtime, e.g. when its code block scrolls into view. */
export function preloadCode(language: string, files: CodeFile[]): void {
  const lang = canonicalRunLang(language)
  if (!lang) return
  getRunner().preload(lang, files.map((f) => f.content).join("\n"))
}

export async function runCode(language: string, files: CodeFile[]): Promise<RunOutcome> {
  const lang = canonicalRunLang(language)
  if (!lang) return { success: false, error: `Language '${language}' is not supported for execution.` }
  try {
    const res = await getRunner().run({ language: lang, files: named(lang, files) })
    if (res.error && !res.stdout && !res.stderr) return { success: false, error: res.error }
    const notes = [res.timedOut && "Stopped: the program ran too long.", res.truncated && "Output truncated."].filter(Boolean)
    return {
      success: true,
      output: res.stdout,
      error: [res.stderr, ...notes].filter(Boolean).join("\n"),
      code: res.exitCode,
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Execution failed." }
  }
}

/**
 * Run state for a code block: preloads the runtime when the block nears the
 * viewport and reports download progress while a run waits on it.
 */
export function useCodeRun(ref: RefObject<HTMLElement | null>, language: string, files: CodeFile[], enabled: boolean) {
  const [running, setRunning] = useState(false)
  const [loadedMb, setLoadedMb] = useState<number | null>(null)
  const source = JSON.stringify(files.map((f) => [f.name, f.content]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const engine = useMemo(() => engineFor(language, files), [language, source])

  useEffect(() => {
    const el = ref.current
    if (!enabled || !engine || !el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        observer.disconnect()
        preloadCode(language, files)
      },
      { rootMargin: "300px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, engine, language])

  useEffect(
    () =>
      onRunProgress((p) => {
        // Bytes only ever grow; a percentage would jump back as each new
        // runtime file starts and adds to the total.
        if (p.engine === engine) setLoadedMb((mb) => Math.max(mb ?? 0, Math.round(p.loaded / 1e5) / 10))
      }),
    [engine],
  )

  const run = async (): Promise<RunOutcome> => {
    setRunning(true)
    setLoadedMb(null)
    try {
      return await runCode(language, files)
    } finally {
      setRunning(false)
      setLoadedMb(null)
    }
  }

  return { run, running, loadedMb }
}

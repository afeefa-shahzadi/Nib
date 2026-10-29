"use client"

import { useEffect, useMemo, useRef, useState } from "react"

export type PreviewFile = { name: string; content: string; lang?: string }

const langOf = (f: PreviewFile) => (f.lang || f.name || "").toLowerCase()

// A block is a web page when it has HTML or CSS: it renders in a sandboxed
// iframe (its JS runs there as page code) instead of through the runner. JS alone is
// a program, so it keeps Run.
export function isWebBlock(files: PreviewFile[]): boolean {
  return files.some((f) => /(^|\.)(html|css)$/.test(langOf(f)))
}

// Runs before user code: forwards console output and uncaught errors to the
// parent so non-DOM JS in a web block still shows visible output.
const CONSOLE_BRIDGE = `<script>(function(){var s=function(v){try{return typeof v==="string"?v:JSON.stringify(v)}catch(e){return String(v)}};var send=function(level,args){parent.postMessage({__nibPreview:1,level:level,text:Array.prototype.map.call(args,s).join(" ")},"*")};["log","info","warn","error"].forEach(function(k){var o=console[k];console[k]=function(){send(k,arguments);o.apply(console,arguments)}});addEventListener("error",function(e){send("error",[e.message])})})()<\/script>`

export function buildSrcDoc(files: PreviewFile[]): string {
  const htmlFile = files.find((f) => /html/.test(langOf(f)))
  const css = files.filter((f) => /css/.test(langOf(f))).map((f) => f.content).join("\n")
  // Escape the closing tag so JS content can't break out of the <script> block.
  const js = files
    .filter((f) => /(^|\.)(javascript|js|jsx)$|^(javascript|js|jsx)$/.test(langOf(f)))
    .map((f) => f.content)
    .join("\n")
    .replace(/<\/script>/gi, "<\\/script>")

  const html = htmlFile?.content ?? ""
  const isFullDoc = /<html|<body|<!doctype/i.test(html)

  if (isFullDoc) {
    // Inject separate css/js files into an already-complete document.
    let doc = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + CONSOLE_BRIDGE) : CONSOLE_BRIDGE + html
    if (css) doc = doc.replace(/<\/head>/i, `<style>${css}</style></head>`)
    if (js) doc = doc.replace(/<\/body>/i, `<script>${js}</script></body>`)
    return doc
  }

  return `<!doctype html><html><head><meta charset="utf-8">${CONSOLE_BRIDGE}<style>body{font-family:system-ui,sans-serif;margin:12px}${css}</style></head><body>${html}<script>${js}</script></body></html>`
}

// Renders user HTML/CSS/JS in a null-origin sandboxed iframe. `allow-scripts`
// WITHOUT `allow-same-origin` means the code can run but cannot read the parent
// page, its cookies, or storage — safe for untrusted author/reader code.
type LogLine = { level: string; text: string }

export function CodePreview({ files }: { files: PreviewFile[] }) {
  const srcDoc = useMemo(() => buildSrcDoc(files), [files])
  const frame = useRef<HTMLIFrameElement>(null)
  // Tagged with the doc that produced them, so an edit clears stale output.
  const [log, setLog] = useState<{ doc: string; lines: LogLine[] }>({ doc: srcDoc, lines: [] })
  const logs = log.doc === srcDoc ? log.lines : []
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // Only this preview's frame; null-origin so the source window is the check.
      if (e.source !== frame.current?.contentWindow || !e.data?.__nibPreview) return
      const line = { level: String(e.data.level), text: String(e.data.text) }
      setLog((l) => ({ doc: srcDoc, lines: l.doc === srcDoc ? [...l.lines.slice(-199), line] : [line] }))
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [srcDoc])
  return (
    <div>
      <iframe
        ref={frame}
        sandbox="allow-scripts allow-modals"
        srcDoc={srcDoc}
        className={`h-80 w-full border-0 bg-white ${logs.length ? "" : "rounded-b-md"}`}
        title="Preview"
      />
      {logs.length > 0 && (
        <pre aria-label="Preview console" className="max-h-40 overflow-auto rounded-b-md border-t border-border bg-[#1e1e1e] p-3 font-mono text-xs text-[#d4d4d4]">
          {logs.map((l, i) => (
            <div key={i} className={l.level === "error" ? "text-[#f48771]" : l.level === "warn" ? "text-[#cca700]" : undefined}>
              {l.text}
            </div>
          ))}
        </pre>
      )}
    </div>
  )
}

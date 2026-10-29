/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useRef, useState } from "react"
import { Play, Loader2, Plus, X, FileCode2, Copy, Check, Eye } from "lucide-react"
import { CodePreview, isWebBlock } from "@/components/code-preview"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import Editor from "react-simple-code-editor"
import { Highlight, themes } from "prism-react-renderer"
import { isRunnableLang } from "@/lib/code-languages"
import { useCodeRun } from "@/lib/run-code"

export interface CodeFile {
  name: string
  content: string
  lang?: string
}

interface CodeBlockEditorProps {
  lang?: string
  text?: string
  files?: CodeFile[]
  onChange: (patch: { lang?: string; text?: string; files?: CodeFile[] }) => void
}

const langFullNames: Record<string, string> = {
  typescript: "TypeScript", javascript: "JavaScript", python: "Python", rust: "Rust", go: "Go",
  c: "C", cpp: "C++", java: "Java", ruby: "Ruby", html: "HTML", css: "CSS", json: "JSON", sql: "SQL", bash: "Bash"
}

const langShortNames: Record<string, string> = {
  typescript: "TS", javascript: "JS", python: "Py", rust: "Rs", go: "Go",
  c: "C", cpp: "C++", java: "Java", ruby: "Rb", html: "HTML", css: "CSS", json: "JSON", sql: "SQL", bash: "Bash"
}

export function CodeBlockEditor({ lang, text, files: initialFiles, onChange }: CodeBlockEditorProps) {
  const [output, setOutput] = useState<{ stdout: string; stderr: string; code?: number | null; signal?: string | null } | null>(null)
  const [outputTab, setOutputTab] = useState<"output" | "console">("output")
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Manage files locally, syncing up on change. If no files prop, start with a default file.
  const [files, setFiles] = useState<CodeFile[]>(() => {
    if (initialFiles && initialFiles.length > 0) return initialFiles
    return [{ name: "main", content: text || "", lang: lang || "typescript" }]
  })
  
  const [activeTab, setActiveTab] = useState(0)

  const [prevInitialFiles, setPrevInitialFiles] = useState(initialFiles)
  const [prevText, setPrevText] = useState(text)
  const [prevLang, setPrevLang] = useState(lang)

  // Sync from props if they change externally (updating state during render)
  if (initialFiles && initialFiles.length > 0 && JSON.stringify(prevInitialFiles) !== JSON.stringify(initialFiles)) {
    setPrevInitialFiles(initialFiles)
    setFiles(initialFiles)
  } else if ((!initialFiles || initialFiles.length === 0) && (text !== prevText || lang !== prevLang)) {
    setPrevText(text)
    setPrevLang(lang)
    setFiles(prev => {
      const currentContent = prev[0]?.content || ""
      const currentLang = prev[0]?.lang || "typescript"
      const newText = text !== undefined ? text : currentContent
      const newLang = lang !== undefined ? lang : currentLang
      if (prev.length === 1 && currentContent === newText && currentLang === newLang) return prev
      return [{ name: prev[0]?.name || "main", content: newText, lang: newLang }]
    })
  }

  const updateFiles = (newFiles: CodeFile[]) => {
    setFiles(newFiles)
    onChange({ 
      files: newFiles, 
      text: newFiles[0]?.content || "",
      lang: newFiles[0]?.lang || "typescript"
    })
  }

  const handleCopy = () => {
    const textToCopy = files[activeTab]?.content || ""
    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleBlur = async () => {
    if (!activeFile) return
    const { content, lang } = activeFile
    if (!content.trim()) return

    try {
      let formatted = content
      
      const nativePrettierLangs = ["javascript", "js", "typescript", "ts", "html", "css", "json"]
      const currentLang = lang?.toLowerCase() || ""

      if (nativePrettierLangs.includes(currentLang)) {
        const prettier = await import("prettier/standalone")
        
        let parserPlugin
        let parserName = ""

        switch (currentLang) {
          case "javascript":
          case "js":
          case "typescript":
          case "ts":
            parserPlugin = await import("prettier/plugins/babel")
            parserName = "babel"
            if (currentLang.includes("ts")) {
              parserPlugin = await import("prettier/plugins/typescript")
              parserName = "typescript"
            }
            const estree = await import("prettier/plugins/estree")
            formatted = await prettier.format(content, {
              parser: parserName,
              plugins: [parserPlugin, estree],
            })
            break
          case "html":
            parserPlugin = await import("prettier/plugins/html")
            parserName = "html"
            formatted = await prettier.format(content, {
              parser: parserName,
              plugins: [parserPlugin],
            })
            break
          case "css":
            parserPlugin = await import("prettier/plugins/postcss")
            parserName = "css"
            formatted = await prettier.format(content, {
              parser: parserName,
              plugins: [parserPlugin],
            })
            break
          case "json":
            parserPlugin = await import("prettier/plugins/babel")
            parserName = "json"
            const pluginEstree = await import("prettier/plugins/estree")
            formatted = await prettier.format(content, {
              parser: parserName,
              plugins: [parserPlugin, pluginEstree],
            })
            break
        }
      } else {
        // Use backend formatting API for unsupported languages
        const res = await fetch("/api/format", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: content, language: currentLang })
        })
        if (res.ok) {
          const data = await res.json()
          if (data.code) {
             formatted = data.code
          }
        }
      }

      if (formatted !== content) {
        updateActiveFile({ content: formatted })
      }
    } catch {
      // Fail silently if code is invalid or formatter crashes
    }
  }

  const handleRun = async () => {
    setOutput(null)
    try {
      const res = await run()
      if (res.success) {
        setOutput({ stdout: res.output || "", stderr: res.error || "", code: res.code, signal: res.signal })
        if (!res.output && res.error) {
          setOutputTab("console")
        } else {
          setOutputTab("output")
        }
      } else {
        setOutput({ stdout: "", stderr: res.error || "Failed to execute." })
        setOutputTab("console")
      }
    } catch (e: any) {
      setOutput({ stdout: "", stderr: e instanceof Error ? e.message : "Execution error" })
      setOutputTab("console")
    }
  }

  const activeFile = files[activeTab] || files[0]
  const executionLang = files.find(f => f.name.startsWith("main"))?.lang || files[0]?.lang || lang || "typescript"
  const isRunnable = isRunnableLang(executionLang)
  const web = isWebBlock(files)
  const rootRef = useRef<HTMLDivElement>(null)
  const { run, running: isRunning, loadedMb } = useCodeRun(
    rootRef,
    executionLang,
    files.map(f => ({ name: f.name, content: f.content })),
    isRunnable && !web,
  )

  const updateActiveFile = (patch: Partial<CodeFile>) => {
    const newFiles = [...files]
    const updatedFile = { ...newFiles[activeTab], ...patch }
    
    const extMap: Record<string, string> = {
      js: "javascript", jsx: "javascript",
      ts: "typescript", tsx: "typescript",
      py: "python",
      rs: "rust",
      go: "go",
      c: "c",
      cpp: "cpp", cc: "cpp", cxx: "cpp",
      java: "java",
      rb: "ruby",
      html: "html",
      css: "css",
      json: "json",
      sql: "sql",
      sh: "bash", bash: "bash"
    }

    if (patch.name !== undefined) {
      const ext = patch.name.split(".").pop()?.toLowerCase()
      if (ext && extMap[ext]) {
        updatedFile.lang = extMap[ext]
      }
    }
    
    if (patch.lang !== undefined && patch.name === undefined) {
      const langToExt: Record<string, string> = {
        javascript: "js", typescript: "ts", python: "py",
        rust: "rs", go: "go", c: "c", cpp: "cpp", java: "java", ruby: "rb",
        html: "html", css: "css", json: "json", sql: "sql", bash: "sh"
      }
      
      const newExt = langToExt[patch.lang.toLowerCase()]
      if (newExt && updatedFile.name) {
        let base = updatedFile.name
        const currentExt = base.split(".").pop()?.toLowerCase()
        if (currentExt && extMap[currentExt]) {
          base = base.substring(0, base.lastIndexOf("."))
        }
        if (!base.endsWith("." + newExt)) {
          updatedFile.name = `${base}.${newExt}`
        }
      }
    }
    
    newFiles[activeTab] = updatedFile
    updateFiles(newFiles)
  }

  const addFile = () => {
    const newFiles = [...files, { name: `file${files.length + 1}.js`, content: "", lang: "javascript" }]
    updateFiles(newFiles)
    setActiveTab(newFiles.length - 1)
  }

  const removeFile = (index: number) => {
    if (files.length <= 1) return
    const newFiles = files.filter((_, i) => i !== index)
    updateFiles(newFiles)
    // Removing a tab *before* the active one shifts every later file down by
    // one, so the active index has to follow it — without this, closing an
    // earlier tab silently selected the wrong file.
    setActiveTab((cur) => {
      if (index === cur) return Math.max(0, index - 1)
      if (index < cur) return cur - 1
      return Math.min(cur, newFiles.length - 1)
    })
  }

  return (
    <div ref={rootRef} className="space-y-0 overflow-y-auto max-h-125 relative rounded-md border border-border">
      {/* Header Tabs */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-muted/90 backdrop-blur-md px-1 sm:px-2 py-1.5 overflow-hidden">
        <div className="flex flex-1 min-w-0 items-center gap-1 overflow-x-auto no-scrollbar">
          {files.map((f, i) => (
            <div
              key={i}
              className={`group flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] cursor-pointer border ${activeTab === i ? "bg-background border-border shadow-sm text-foreground" : "border-transparent text-muted-foreground hover:bg-muted"}`}
              onClick={() => setActiveTab(i)}
            >
              <FileCode2 className="size-3 opacity-60" />
              {activeTab === i ? (
                <input 
                  value={f.name}
                  onChange={(e) => updateActiveFile({ name: e.target.value })}
                  className="bg-transparent focus:outline-none w-16 sm:w-20 text-[11px]"
                  placeholder="filename"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span>{f.name || "unnamed"}</span>
              )}
              {files.length > 1 && (
                <button
                  className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-0.5 hover:bg-accent rounded transition-opacity"
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          ))}
          <button onClick={addFile} className="mx-1 p-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <Plus className="size-3" />
          </button>
        </div>

        {/* Action Right */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2 pl-1 sm:pl-2 border-l border-border/50 ml-1 sm:ml-2">
          <Select
            value={activeFile?.lang || "typescript"}
            onValueChange={(val) => updateActiveFile({ lang: val })}
          >
            <SelectTrigger aria-label="Language" className="h-6 w-14 sm:w-24 px-1.5 sm:px-3 border bg-transparent text-[11px] shadow-none focus:ring-1 overflow-hidden text-ellipsis whitespace-nowrap">
              <SelectValue placeholder="Language">
                <span className="sm:hidden">{langShortNames[(activeFile?.lang || "typescript").toLowerCase()] || activeFile?.lang || "TS"}</span>
                <span className="hidden sm:inline">{langFullNames[(activeFile?.lang || "typescript").toLowerCase()] || activeFile?.lang || "TypeScript"}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="h-60" sideOffset={2} align="start">
              <SelectItem value="typescript">TypeScript</SelectItem>
              <SelectItem value="javascript">JavaScript</SelectItem>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="rust">Rust</SelectItem>
              <SelectItem value="go">Go</SelectItem>
              <SelectItem value="c">C</SelectItem>
              <SelectItem value="cpp">C++</SelectItem>
              <SelectItem value="java">Java</SelectItem>
              <SelectItem value="ruby">Ruby</SelectItem>
              <SelectItem value="html">HTML</SelectItem>
              <SelectItem value="css">CSS</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="sql">SQL</SelectItem>
              <SelectItem value="bash">Bash</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
            title="Copy Code"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </Button>

          {isRunnable && !web && (
            <Button
              size="sm"
              variant="secondary"
              className="h-6 px-1.5 sm:px-2 text-[10px]"
              onClick={handleRun}
              disabled={isRunning || !activeFile?.content.trim()}
            >
              {isRunning ? <Loader2 className="sm:mr-1 size-3 animate-spin" /> : <Play className="sm:mr-1 size-3" />}
              <span className="hidden sm:inline">{isRunning ? (loadedMb ? `Loading ${loadedMb.toFixed(1)} MB` : "Running") : "Run"}</span>
            </Button>
          )}
          {web && (
            <Button
              size="sm"
              variant="secondary"
              className="h-6 px-1.5 sm:px-2 text-[10px]"
              onClick={() => setShowPreview((v) => !v)}
            >
              <Eye className="sm:mr-1 size-3" />
              <span className="hidden sm:inline">{showPreview ? "Hide" : "Preview"}</span>
            </Button>
          )}
        </div>
      </div>

      {web && showPreview && <CodePreview files={files} />}
      {web && files.some((f) => /(^|\.)(javascript|js|jsx)$/.test((f.lang || f.name).toLowerCase())) && (
        <p className="px-3 py-1.5 text-[11px] text-muted-foreground">
          JS in this block runs inside the preview page. To run Node JS, put it in its own block.
        </p>
      )}

      <div className="relative bg-[#1e1e1e] min-h-37.5 text-[#d4d4d4] font-mono text-[13px]">
        <Editor
          value={activeFile?.content || ""}
          onValueChange={(code) => updateActiveFile({ content: code })}
          onBlur={handleBlur}
          highlight={(code) => (
            <Highlight
              theme={themes.vsDark}
              code={code}
              language={(activeFile?.lang || "text") as import("prism-react-renderer").Language}
            >
              {({ tokens, getLineProps, getTokenProps }) => (
                <>
                  {tokens.map((line, i) => (
                    <div key={i} {...getLineProps({ line })}>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  ))}
                </>
              )}
            </Highlight>
          )}
          padding={16}
          style={{
            fontFamily: "inherit",
            fontSize: "inherit",
            minHeight: "150px",
            backgroundColor: "transparent",
          }}
          textareaClassName="focus:outline-none"
        />
      </div>

      {output && (
        <div className="border-t border-border bg-surface text-sm flex flex-col">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 pt-1">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setOutputTab("output")}
                className={`py-1.5 text-[11px] font-semibold tracking-wider uppercase border-b-2 transition-colors ${outputTab === "output" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                Output
              </button>
              <button
                onClick={() => setOutputTab("console")}
                className={`py-1.5 text-[11px] font-semibold tracking-wider uppercase border-b-2 transition-colors ${outputTab === "console" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                Console
              </button>
            </div>
            <button onClick={() => setOutput(null)} className="text-muted-foreground hover:text-foreground">
              <X className="size-3" />
            </button>
          </div>
          <div className="p-3">
            {outputTab === "output" && (
              <>
                {output.stdout && (
                  <pre className="whitespace-pre-wrap font-mono text-[12px] text-foreground">{output.stdout}</pre>
                )}
                {!output.stdout && (
                  <span className="text-[11px] italic text-muted-foreground">Executed with no output.</span>
                )}
              </>
            )}
            {outputTab === "console" && (
              <>
                {output.stderr && (
                  <pre className="whitespace-pre-wrap font-mono text-[12px] text-destructive mb-2">{output.stderr}</pre>
                )}
                {output.code !== undefined && (
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Process exited with code {output.code} {output.signal ? `(signal: ${output.signal})` : ""}
                  </div>
                )}
                {!output.stderr && output.code === undefined && (
                  <span className="text-[11px] italic text-muted-foreground">No console events.</span>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

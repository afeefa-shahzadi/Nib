/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, useState } from "react"
import { Highlight, themes } from "prism-react-renderer"
import { Block, getText, getStr } from "../block-renderer"
import { executeCode, codeRunEnabled } from "@/actions/code"
import { isRunnableLang } from "@/lib/code-languages"
import { CodePreview, isWebBlock } from "@/components/code-preview"
import { Play, Loader2, FileCode2, X, Copy, Check, Eye } from "lucide-react"

export function CodeBlock({ block, isPreview }: { block: Block; isPreview?: boolean }) {
  const fallbackText = getText(block.content)
  const fallbackLang = getStr(block.content, "lang") || "text"
  const files = Array.isArray(block.content.files) && block.content.files.length > 0
    ? block.content.files
    : [{ name: "main", content: fallbackText, lang: fallbackLang }]
  
  const [activeTab, setActiveTab] = useState(0)
  const activeFile = files[activeTab] || files[0]

  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState<{ stdout: string; stderr: string; code?: number | null; signal?: string | null } | null>(null)
  const [outputTab, setOutputTab] = useState<"output" | "console">("output")
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [runEnabled, setRunEnabled] = useState(false)
  useEffect(() => { codeRunEnabled().then(setRunEnabled).catch(() => {}) }, [])
  const web = isWebBlock(files)

  const handleCopy = () => {
    const textToCopy = files[activeTab]?.content || ""
    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRun = async () => {
    setIsRunning(true)
    setOutput(null)
    try {
      const executionLang = files.find(f => f.name.startsWith("main"))?.lang || files[0]?.lang || fallbackLang
      const res = await executeCode(executionLang, files.map(f => ({ name: f.name, content: f.content })))
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
    } finally {
      setIsRunning(false)
    }
  }

  const executionLang = files.find(f => f.name.startsWith("main"))?.lang || files[0]?.lang || fallbackLang
  const isRunnable = isRunnableLang(executionLang)

  return (
    <div className="group relative my-5 flex flex-col gap-0 rounded-md border border-border shadow-sm max-h-125 overflow-y-auto">
      {/* Tab Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-[#1e1e1e]/95 backdrop-blur-md px-2 py-1.5 text-[#d4d4d4]">
        <div className="flex items-center gap-1 overflow-x-auto">
          {files.map((f, i) => (
            <div
              key={i}
              onClick={() => setActiveTab(i)}
              className={`flex cursor-pointer items-center gap-1.5 rounded-sm px-3 py-1 text-[11px] transition-colors ${
                activeTab === i
                  ? "bg-[#2d2d2d] text-white shadow-sm"
                  : "text-[#858585] hover:bg-[#2d2d2d] hover:text-[#d4d4d4]"
              }`}
            >
              <FileCode2 className="size-3" />
              <span>{f.name || "unnamed"}</span>
            </div>
          ))}
        </div>
        
        <div className="flex items-center gap-2 pr-1">
          <p className="font-mono text-[10px] tracking-wider text-[#858585] uppercase mr-1">
            {activeFile.lang || "text"}
          </p>
          {!isPreview && (
            <button
              onClick={handleCopy}
              className="group flex size-6 cursor-pointer items-center justify-center rounded-sm text-[#858585] transition-colors hover:bg-[#333] hover:text-white"
              title="Copy"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            </button>
          )}

          {!isPreview && isRunnable && !web && runEnabled && (
            <button
              onClick={handleRun}
              disabled={isRunning || !activeFile?.content.trim()}
              className="flex h-6 items-center gap-1.5 rounded bg-[#4fc1ff]/10 px-2 text-[10px] font-medium text-[#4fc1ff] transition-colors hover:bg-[#4fc1ff]/20 disabled:opacity-50"
            >
              {isRunning ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
              {isRunning ? "Running" : "Run"}
            </button>
          )}
          {!isPreview && web && (
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="flex h-6 items-center gap-1.5 rounded bg-[#4fc1ff]/10 px-2 text-[10px] font-medium text-[#4fc1ff] transition-colors hover:bg-[#4fc1ff]/20"
            >
              <Eye className="size-3" />
              {showPreview ? "Hide" : "Preview"}
            </button>
          )}
        </div>
      </div>

      {!isPreview && web && showPreview && <CodePreview files={files} />}

      {/* Code Editor Area */}
      <div className="relative bg-[#1e1e1e] min-h-25">
        <Highlight
          theme={themes.vsDark}
          code={activeFile.content || ""}
          language={(activeFile.lang || "text") as import("prism-react-renderer").Language}
        >
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={`${className} overflow-x-auto p-4 font-mono text-[13px] leading-relaxed`}
              style={{ ...style, backgroundColor: "transparent" }}
            >
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>
      
      {/* Output Panel */}
      {output && (
        <div className="border-t border-[#333] bg-[#1e1e1e] flex flex-col text-sm text-[#d4d4d4]">
          <div className="flex items-center justify-between border-b border-[#333] bg-[#2d2d2d]/30 px-3 pt-1">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setOutputTab("output")}
                className={`py-1.5 text-[11px] font-semibold tracking-wider uppercase border-b-2 transition-colors ${outputTab === "output" ? "border-[#4fc1ff] text-white" : "border-transparent text-[#858585] hover:text-[#cccccc]"}`}
              >
                Output
              </button>
              <button
                onClick={() => setOutputTab("console")}
                className={`py-1.5 text-[11px] font-semibold tracking-wider uppercase border-b-2 transition-colors ${outputTab === "console" ? "border-[#4fc1ff] text-white" : "border-transparent text-[#858585] hover:text-[#cccccc]"}`}
              >
                Console
              </button>
            </div>
            <button onClick={() => setOutput(null)} className="text-[#858585] hover:text-white transition-colors">
              <X className="size-3" />
            </button>
          </div>
          <div className="p-3">
            {outputTab === "output" && (
              <>
                {output.stdout && (
                  <pre className="whitespace-pre-wrap font-mono text-[12px]">{output.stdout}</pre>
                )}
                {!output.stdout && (
                  <span className="text-[11px] italic text-[#858585]">Executed with no output.</span>
                )}
              </>
            )}
            {outputTab === "console" && (
              <>
                {output.stderr && (
                  <pre className="whitespace-pre-wrap font-mono text-[12px] text-destructive mb-2">{output.stderr}</pre>
                )}
                {output.code !== undefined && (
                  <div className="text-[11px] text-[#858585] mt-1">
                    Process exited with code {output.code} {output.signal ? `(signal: ${output.signal})` : ""}
                  </div>
                )}
                {!output.stderr && output.code === undefined && (
                  <span className="text-[11px] italic text-[#858585]">No console events.</span>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

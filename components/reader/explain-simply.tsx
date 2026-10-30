"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Sparkles } from "lucide-react"
import { generateModeVariant } from "@/actions/ai"
import { canUseAISummary } from "@/actions/accessibility"
import { textOf } from "@/components/reader-actions"
import { inlineMarkdownToHtml } from "@/lib/import/inline-markdown"

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
import { Button } from "@/components/ui/button"

type Props = {
  authed: boolean
  blocks?: { content?: Record<string, unknown> }[]
  articleRef: React.RefObject<HTMLElement | null>
}

// Teach mode's beginner step: an on-demand, jargon-free explanation of the
// whole piece (the old ELI5 summary), shown inline above the text.
export function ExplainSimply({ authed, blocks, articleRef }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState("")

  const explain = async () => {
    if (!authed) return router.push("/login")
    setOpen(true)
    if (result) return
    setLoading(true)
    try {
      if (!(await canUseAISummary())) {
        toast.error("AI summaries need a Studio plan or accessibility access.")
        setOpen(false)
        return
      }
      const fullText = blocks?.length
        ? blocks
            .map((b) => textOf(b.content))
            .join(" ")
            .trim()
        : (articleRef.current?.innerText ?? "")
      if (!fullText) {
        toast.error("No content found to explain.")
        setOpen(false)
        return
      }
      // Cap the source to keep token use bounded.
      const res = await generateModeVariant({
        data: { mode: "eli5", source: fullText.slice(0, 15000) },
      })
      if (res.error !== undefined) throw new Error(res.error)
      setResult(res.text)
    } catch (e) {
      toast.error((e as Error).message)
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="surface mb-8 rounded-xl border border-border/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          New to this topic? Start with the simple version.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={open ? () => setOpen(false) : explain}
        >
          <Sparkles /> {open ? "Hide" : "Explain simply"}
        </Button>
      </div>
      {open && (
        <div
          className="mt-3 space-y-2 text-sm leading-relaxed"
          aria-live="polite"
        >
          {loading ? (
            <span className="animate-pulse">Writing a simple explanation…</span>
          ) : (
            result?.split(/\n{2,}/).map((para, i) => (
              <p
                key={i}
                dangerouslySetInnerHTML={{
                  __html:
                    inlineMarkdownToHtml(para.trim()) ??
                    escapeHtml(para.trim()),
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

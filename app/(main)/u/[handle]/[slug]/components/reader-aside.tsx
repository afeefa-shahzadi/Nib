import Link from "next/link"
import { List, Link2, ThumbsUp, ThumbsDown, BookOpen } from "lucide-react"
import { TipJar } from "@/components/tip-jar"
import {
  PieceData,
  AuthorData,
  BranchData,
  RelatedPiece,
} from "@/lib/types/content"
import { submitRecommendationFeedback } from "@/actions/recommendations"
import { useState } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { toast } from "sonner"

interface ReaderAsideProps {
  piece: PieceData
  author: AuthorData | null
  headings: Array<{ id: string; text: string }>
  branches: BranchData[]
  related: RelatedPiece[]
  authed: boolean
  isAuthor?: boolean
  tipRef: React.RefObject<HTMLDivElement | null>
  onSignInRequired: () => void
  isMobileSheet?: boolean
  variant?: "desktop" | "mobile-sheet" | "mobile-footer"
  sourcesCount?: number
  onShowSources?: () => void
}

export function ReaderAside({
  piece,
  author,
  headings,
  branches,
  related,
  authed,
  tipRef,
  onSignInRequired,
  isMobileSheet,
  variant = "desktop",
  sourcesCount = 0,
  onShowSources,
}: ReaderAsideProps) {
  const effectiveVariant = isMobileSheet ? "mobile-sheet" : variant
  const showOutline =
    effectiveVariant === "desktop" || effectiveVariant === "mobile-sheet"
  const showBranches =
    effectiveVariant === "desktop" || effectiveVariant === "mobile-sheet"
  const showTipJar =
    effectiveVariant === "desktop" || effectiveVariant === "mobile-footer"
  const showRelated =
    effectiveVariant === "desktop" || effectiveVariant === "mobile-footer"
  // Keyboard tips live in the "More" sheet, not as small print beside the piece.
  const showTipText = effectiveVariant === "mobile-sheet"

  const [feedbackState, setFeedbackState] = useState<Record<string, boolean>>({})
  const [feedbackLoading, setFeedbackLoading] = useState<Record<string, boolean>>({})

  const handleFeedback = async (pieceId: string, isLike: boolean) => {
    if (!authed) {
      onSignInRequired()
      return
    }
    setFeedbackLoading((prev) => ({ ...prev, [pieceId]: true }))
    try {
      const res = await submitRecommendationFeedback(pieceId, isLike)
      if (res.success) {
        setFeedbackState((prev) => ({ ...prev, [pieceId]: isLike }))
        toast.success(isLike ? "Show more like this" : "Show less like this")
      } else {
        toast.error(res.error || "Failed to submit feedback")
      }
    } catch {
      toast.error("An error occurred")
    } finally {
      setFeedbackLoading((prev) => ({ ...prev, [pieceId]: false }))
    }
  }

  return (
    <aside className="space-y-6">
      {/* Outline */}
      {showOutline && headings.length > 0 && (
        <Panel value="outline" title={<><List className="size-3.5" aria-hidden /> On this page</>}>
          <nav aria-label="In-page outline" className="space-y-1.5">
            {headings.map((h) => (
              <Link
                key={h.id}
                href={`#${h.id}`}
                className="flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-foreground lg:block lg:min-h-0"
              >
                {h.text}
              </Link>
            ))}
          </nav>
        </Panel>
      )}

      {sourcesCount > 0 && onShowSources && (
        <button
          type="button"
          onClick={onShowSources}
          className="surface flex min-h-11 w-full items-center gap-2 rounded-md p-5 text-left text-sm hover:bg-accent/40"
        >
          <BookOpen className="size-4 text-muted-foreground" aria-hidden />
          {sourcesCount} {sourcesCount === 1 ? "source" : "sources"}
          <span className="ml-auto text-muted-foreground" aria-hidden>›</span>
        </button>
      )}

      {showTipJar && author && (
        <div ref={tipRef}>
          <TipJar
            authorId={piece.author_id}
            authorName={author.display_name}
            contentObjectId={piece.id}
          />
        </div>
      )}

      {showBranches && branches.length > 0 && (
        <Panel id="branches" value="branches" title={`Branches · ${branches.length}`}>
          <ul className="space-y-3">
            {branches.map((b) => {
              const gated = b.visibility !== "public" && !authed
              return (
                <li key={b.id}>
                  <p className="text-xs text-primary first-letter:uppercase">
                    {b.branch_type}
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {b.purpose ?? b.summary ?? "Untitled branch"}
                  </p>
                  {gated && (
                    <Link
                      href="/login"
                      className="mt-1 inline-block text-xs text-muted-foreground hover:text-foreground"
                    >
                      Sign in to read →
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </Panel>
      )}

      {showRelated && related.length > 0 && (
        <div className="surface rounded-md p-5">
          <p className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Link2 className="size-3" /> Related
          </p>
          <ul className="space-y-3">
            {related.map((r) => (
              <li key={r.id}>
                <p className="text-xs text-primary first-letter:uppercase">
                  {r.type}
                </p>
                <Link
                  href={`/u/${r.handle}/${r.slug}`}
                  className="mt-0.5 block text-sm text-foreground hover:text-primary"
                >
                  {r.title}
                </Link>
                {r.summary && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {r.summary}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between gap-2">
                  {(r.claps ?? 0) > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground" title={`${r.claps} claps`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-hand">
                        <path d="M18 11V6a2 2 0 0 0-4 0v4" />
                        <path d="M14 10V4a2 2 0 0 0-4 0v6" />
                        <path d="M10 10.5V3a2 2 0 0 0-4 0v9" />
                        <path d="m7 15-1.76-1.76a2 2 0 0 0-2.83 2.82l3.6 3.6C7.5 21.14 9.2 22 12 22h2a8 8 0 0 0 8-8V7a2 2 0 1 0-4 0v5" />
                      </svg>
                      {r.claps}
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleFeedback(r.id, true)}
                      disabled={feedbackLoading[r.id]}
                      className={`inline-flex size-11 items-center justify-center rounded transition-colors lg:size-8 hover:bg-accent/60 ${feedbackState[r.id] === true ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                        }`}
                      title="Show more like this"
                      aria-label="Show more like this"
                    >
                      <ThumbsUp className="size-3" />
                    </button>
                    <button
                      onClick={() => handleFeedback(r.id, false)}
                      disabled={feedbackLoading[r.id]}
                      className={`inline-flex size-11 items-center justify-center rounded transition-colors lg:size-8 hover:bg-accent/60 ${feedbackState[r.id] === false ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:text-foreground"
                        }`}
                      title="Show less like this"
                      aria-label="Show less like this"
                    >
                      <ThumbsDown className="size-3" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showTipText && (
        <p className="px-1 text-sm text-muted-foreground">
          Tip: press{" "}
          <kbd className="rounded bg-muted px-1 py-0.5 text-xs">1</kbd>–
          <kbd className="rounded bg-muted px-1 py-0.5 text-xs">5</kbd> to
          switch reading modes.
        </p>
      )}
    </aside>
  )
}

// Collapsible sidebar section; long lists scroll inside instead of stretching the sidebar.
function Panel({ id, value, title, children }: { id?: string; value: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <Accordion id={id} type="single" collapsible defaultValue={value} className="surface scroll-mt-24 rounded-md px-5">
      <AccordionItem value={value} className="border-b-0">
        <AccordionTrigger className="min-h-11 py-3 text-sm font-medium hover:no-underline">
          <span className="flex items-center gap-1.5">{title}</span>
        </AccordionTrigger>
        <AccordionContent className="pb-4"><div className="custom-scrollbar max-h-72 overflow-y-auto pr-1">{children}</div></AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

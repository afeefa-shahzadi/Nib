/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { tickReadingStreak } from "@/actions/monetization"
import { PublicSponsorCard } from "@/components/reader/public-sponsor-card"
import {
  ReaderBody,
  extractHeadings,
  estimateReadingMinutes,
  type ReadingMode,
  type Block,
} from "@/components/block-renderer"
import { MentionHoverPortal } from "@/components/mention-hover-portal"
import { HighlightBubble } from "@/components/reader/highlight-bubble"
import { InlineThreadPopover } from "@/components/reader/inline-thread-popover"
import { HighlightHoverTrash } from "@/components/reader/highlight-hover-trash"
import { SponsoredBanner } from "@/components/sponsored-banner"
import { PlatformBoostAd } from "@/components/reader/platform-boost-ad"
import { ReaderActions } from "@/components/reader-actions"
import { EmbeddedRepost } from "@/components/reader/embedded-repost"
import { ClapProvider } from "@/components/clap-button"
import { SubscribeCard } from "@/components/reader/subscribe-card"
import { PremiumTeaserOverlay } from "@/components/premium-teaser-overlay"
import { SourcesSheet, type SegregatedSources } from "@/components/reader/sources-sheet"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import { buyPiece } from "@/lib/razorpay/checkout-client"
import { SubscribeDialog } from "@/components/subscribe-dialog"
import { createHighlight } from "@/actions/highlights"
import { ChevronDown, ChevronLeft, ChevronRight, BookOpen } from "lucide-react"
import { useReaderTelemetry } from "@/hooks/use-telemetry"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FollowButton } from "@/components/follow-button"
import { SourceCitation } from "@/lib/types/content"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  PieceData,
  AuthorData,
  PrevNextPiece,
  BranchData,
  RelatedPiece,
  DebateRoomItem,
} from "@/lib/types/content"
import { MODES, MODE_HINT } from "@/lib/content/reader/data"
import { availableModes } from "@/lib/reader-variants"
import { ReaderHeader } from "./components/reader-header"
import { ReaderAside } from "./components/reader-aside"
import { FootnotesSection } from "./components/footnotes-section"
import dynamic from "next/dynamic"

// Conditional UI: fetch on first use, not with the reader shell.
const DebateRoom = dynamic(() => import("@/components/debate-room").then((m) => m.DebateRoom), { ssr: false })
const AnnotationDialog = dynamic(() => import("@/components/reader/annotation-dialog").then((m) => m.AnnotationDialog), { ssr: false })
const SubscribeModal = dynamic(() => import("@/components/reader/subscribe-modal").then((m) => m.SubscribeModal), { ssr: false })

export function ReaderClient({
  piece,
  blocks,
  branches,
  author,
  prev,
  next,
  viewerHasAccess,
  launchFree = false,
  initialRooms,
  initialRelated,
  initialBoosts,
  initialSaved,
  isAdult = false,
  hasDob = false,
  originalPiece,
  originalAuthor,
  originalBlocks,
  commentSources = [],
  initialHighlights = [],
  initialComments = [],
}: {
  piece: PieceData
  blocks: any[]
  branches: BranchData[]
  author: AuthorData | null
  prev: PrevNextPiece | null
  next: PrevNextPiece | null
  viewerHasAccess: boolean
  launchFree?: boolean
  initialRooms: DebateRoomItem[]
  initialRelated: RelatedPiece[]
  initialBoosts: Record<string, unknown>[]
  initialSaved: boolean
  isAdult?: boolean
  hasDob?: boolean
  originalPiece?: PieceData | null
  originalAuthor?: AuthorData | null
  originalBlocks?: any[]
  commentSources?: SourceCitation[]
  initialHighlights?: any[]
  initialComments?: any[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const subscribe = () => {
    if (!authed) return router.push("/login")
    setSubscribeOpen(true)
  }
  // Buying opens this piece only; ?via= credits the collection's curator.
  const buy = async () => {
    if (!authed) return router.push("/login")
    try {
      if (await buyPiece(piece.id, searchParams.get("via") ?? undefined)) {
        toast.success("Unlocked. Thanks for supporting the author.")
        router.refresh()
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  const [showFollowDialog, setShowFollowDialog] = useState(false)
  // Only offer modes that actually change this piece; an unavailable requested mode reads as Standard.
  const modes = useMemo(() => availableModes(blocks as Block[], MODES), [blocks])
  const requestedMode = searchParams?.get("mode") as ReadingMode | null
  const mode: ReadingMode = requestedMode && modes.includes(requestedMode) ? requestedMode : "standard"
  const [authed, setAuthed] = useState(false)
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  
  const [annotationOpen, setAnnotationOpen] = useState(false)
  const [selectedText, setSelectedText] = useState("")

  const [inlineComments, setInlineComments] = useState(initialComments || [])
  const [optimisticHighlights, setOptimisticHighlights] = useState<any[]>([])
  const [threadPopoverState, setThreadPopoverState] = useState<{
    open: boolean
    anchorRect: DOMRect | null
    parentComment: any | null
    quotedText?: string
  }>({ open: false, anchorRect: null, parentComment: null })

  // Handle click on existing inline comments & highlights
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.classList.contains("inline-comment-marker")) {
        const commentId = target.getAttribute("data-comment-id")
        const parentComment = inlineComments.find((c: any) => c.id === commentId)
        if (parentComment) {
          setThreadPopoverState({
            open: true,
            anchorRect: target.getBoundingClientRect(),
            parentComment,
          })
        }
      }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [inlineComments])


  const [hasAccess] = useState(viewerHasAccess)
  const [rooms] = useState<DebateRoomItem[]>(initialRooms)
  const [related] = useState<RelatedPiece[]>(initialRelated)
  const [boosts] = useState<Record<string, unknown>[]>(initialBoosts)

  const [progress, setProgress] = useState(0)

  const [moreOpen, setMoreOpen] = useState(false)

  const tipRef = useRef<HTMLDivElement | null>(null)
  const articleRef = useRef<HTMLElement | null>(null)
  const modeGroupRef = useRef<HTMLDivElement | null>(null)

  // Keep the active mode chip in view when the mode control scrolls (phones).
  useEffect(() => {
    const g = modeGroupRef.current
    const on = g?.querySelector<HTMLElement>('[data-state="on"]')
    if (!g || !on) return
    const a = g.getBoundingClientRect()
    const b = on.getBoundingClientRect()
    if (b.left < a.left) g.scrollLeft -= a.left - b.left + 12
    else if (b.right > a.right) g.scrollLeft += b.right - a.right + 12
  }, [mode])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setAuthed(!!s?.user)
      setViewerId(s?.user?.id ?? null)
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session?.user)
      setViewerId(session?.user?.id ?? null)
      if (session?.user) {
        tickReadingStreak().catch(console.error)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Reading progress + telemetry (view, mode_switch, read_depth)
  const { recordShare } = useReaderTelemetry({
    pieceId: piece.id,
    mode,
    articleRef,
  })
  useEffect(() => {
    // One prompt per reader: signed-in readers get Follow here, guests get the email modal.
    let canPromptFollow = !!author && !!viewerId && viewerId !== piece.author_id
    const promptFollow = () => {
      if (!canPromptFollow) return
      canPromptFollow = false
      const key = `has_seen_follow_dialog_${piece.author_id}`
      try {
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, "true")
          setShowFollowDialog(true)
        }
      } catch {}
    }
    const fitsOnScreen = () => {
      const el = articleRef.current
      return !!el && el.scrollHeight <= window.innerHeight
    }
    // A piece that fits on one screen never reaches 60%: prompt after 25s instead.
    const shortTimer = setTimeout(() => {
      if (fitsOnScreen()) promptFollow()
    }, 25000)
    const onScroll = () => {
      const el = articleRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const total = el.scrollHeight - window.innerHeight
      const scrolled = Math.max(0, -rect.top)
      const p = total > 0 ? Math.min(100, (scrolled / total) * 100) : 0
      // One-time follow dialog, once the reader is well into the piece.
      if (p >= 60) promptFollow()
      setProgress((prev) => (Math.abs(prev - p) > 0.5 ? p : prev))
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      clearTimeout(shortTimer)
      window.removeEventListener("scroll", onScroll)
    }
  }, [author, viewerId, piece.author_id])

  const setMode = useCallback(
    (m: ReadingMode) => {
      if (typeof window !== "undefined")
        window.localStorage.setItem("reader:mode", m)
      router.push(`/u/${author?.handle ?? ""}/${piece.slug}?mode=${m}`)
    },
    [author?.handle, piece.slug, router]
  )

  // Keyboard shortcuts (number keys -> offered modes)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const idx = Number(e.key) - 1
      // Keys index the modes on offer; no switcher, no shortcuts.
      if (modes.length > 1 && idx >= 0 && idx < modes.length) {
        e.preventDefault()
        setMode(modes[idx])
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [modes, setMode])

  // The header already shows the title: drop a leading heading that repeats it (body and TOC).
  const dedupedBlocks = useMemo(
    () =>
      (blocks as Block[]).filter(
        (b, i) =>
          !(
            i === 0 &&
            b.type === "heading" &&
            String((b.content as { text?: string })?.text ?? "").trim() === piece.title.trim()
          )
      ),
    [blocks, piece.title]
  )
  const headings = useMemo(
    () => extractHeadings(dedupedBlocks, mode),
    [dedupedBlocks, mode]
  )
  const minutes = useMemo(
    () => estimateReadingMinutes(blocks as Block[], mode),
    [blocks, mode]
  )
  const footnotes = useMemo(
    () => (blocks as Block[]).filter((b) => b.semantic_role === "footnote"),
    [blocks]
  )
  const bodyBlocks = useMemo(
    () => dedupedBlocks.filter((b) => b.semantic_role !== "footnote"),
    [dedupedBlocks]
  )

  const aggregatedSources: SegregatedSources = useMemo(() => ({
    pieceSources: piece.sources || [],
    blockSources: bodyBlocks.flatMap((b) => b.sources || []),
    commentSources: commentSources || [],
  }), [piece.sources, bodyBlocks, commentSources])

  const sourceCount =
    aggregatedSources.pieceSources.length +
    aggregatedSources.blockSources.length +
    aggregatedSources.commentSources.length
  const hasAnySources = sourceCount > 0

  const listenBlocks = useMemo(() => {
    let arr = [...bodyBlocks]
    if (originalBlocks && Array.isArray(originalBlocks)) {
      arr = arr.concat(
        (originalBlocks as Block[]).filter((b) => b.semantic_role !== "footnote")
      )
    }
    return arr
  }, [bodyBlocks, originalBlocks])

  const share = async () => {
    if (typeof window === "undefined") return
    const url = window.location.href
    const title = piece.title
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        recordShare()
      } else {
        await navigator.clipboard.writeText(url)
        recordShare()
        toast.success("Link copied")
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url)
        recordShare()
        toast.success("Link copied")
      } catch {
        toast.error("Couldn't copy link")
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Reading progress bar */}
      <div
        aria-hidden
        className="fixed top-0 right-0 left-0 z-40 h-0.5 bg-primary/80 transition-[width] duration-150"
        style={{ width: `${progress}%` }}
      />

      <MentionHoverPortal containerRef={articleRef} />
      <HighlightHoverTrash
        viewerId={viewerId}
        highlights={[...initialHighlights, ...optimisticHighlights]}
        onDelete={(highlightId) => {
          setOptimisticHighlights(prev => prev.filter(h => h.id !== highlightId))
          import("@/actions/highlights").then(({ deleteHighlight }) => {
            deleteHighlight(highlightId).then(() => router.refresh()).catch(() => toast.error("Failed to delete"))
          })
        }}
      />
      <HighlightBubble
        containerRef={articleRef}
        pieceTitle={piece.title}
        onAnnotate={(text) => {
          if (!authed) {
            router.push("/login")
            return
          }
          setSelectedText(text)
          setOptimisticHighlights((prev) => [
            ...prev.filter(h => h.id !== "temp-new-annotate"),
            { id: "temp-new-annotate", piece_id: piece.id, text_content: text, created_at: new Date().toISOString(), annotations: [{ note: "..." }] }
          ])
          setAnnotationOpen(true)
        }}
        onComment={(text, rect) => {
          if (!authed) {
            router.push("/login")
            return
          }
          // Temporarily add it to inlineComments so it gets highlighted
          setInlineComments((prev) => [
            ...prev.filter(c => c.id !== "temp-new-comment"),
            { id: "temp-new-comment", quoted_text: text, created_at: new Date().toISOString() }
          ])
          
          setThreadPopoverState({
            open: true,
            anchorRect: rect,
            parentComment: null,
            quotedText: text,
          })
        }}
        onHighlight={async (text) => {
          if (!authed) {
            router.push("/login")
            return
          }
          setOptimisticHighlights((prev) => [
            ...prev.filter(h => h.id !== "temp-new-highlight"),
            { id: "temp-new-highlight", piece_id: piece.id, text_content: text, created_at: new Date().toISOString() }
          ])
          const res = await createHighlight(piece.id, text)
          if (res.success) {
            router.refresh()
          } else {
            toast.error(res.error || "Failed to highlight")
            setOptimisticHighlights(prev => prev.filter(h => h.id !== "temp-new-highlight"))
          }
        }}
      />
      <AnnotationDialog
        open={annotationOpen}
        onOpenChange={(open) => {
          setAnnotationOpen(open)
          if (!open) setOptimisticHighlights(prev => prev.filter(h => h.id !== "temp-new-annotate"))
        }}
        pieceId={piece.id}
        selectedText={selectedText}
        onAnnotationSaved={() => {
          setAnnotationOpen(false)
          setOptimisticHighlights(prev => prev.filter(h => h.id !== "temp-new-annotate"))
          router.refresh()
        }}
      />

      {/* One clap state for the bar and the aside Applause card. */}
      <ClapProvider pieceId={piece.id} authed={authed} onSignInRequired={() => router.push("/login")}>
      <main className="container-wide grid flex-1 items-start gap-12 py-12 lg:grid-cols-[minmax(0,42rem)_minmax(18rem,1fr)] lg:gap-16 xl:gap-24">
        <article ref={articleRef} className="w-full max-w-[42rem] min-w-0">
          <SponsoredBanner contentObjectId={piece.id} />

          {piece.cover_image_url && (
            <div className="mb-10 w-full overflow-hidden rounded-xl border border-border">
              <Image
                src={piece.cover_image_url}
                alt={piece.title}
                width={1200}
                height={600}
                unoptimized={!piece.cover_image_url.includes("supabase.co")}
                className="w-full h-auto max-h-[60vh] object-cover"
              />
            </div>
          )}

          <ReaderHeader
            piece={piece}
            author={author}
            minutes={minutes}
            mode={mode}
            isAuthor={viewerId === piece.author_id}
          />

          {/* Sticky mode bar */}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <div data-reader-bar className="hairline-b sticky top-16 z-20 -mx-3 mt-10 flex items-center gap-2 bg-background/85 px-3 py-1 backdrop-blur">
              {/* Below md: one compact control instead of chips that would be cut off. */}
              {modes.length < 2 ? <div className="flex-1" /> : (<>
              <div className="min-w-0 flex-1 md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      aria-label={`Reading mode: ${mode}`}
                      className="h-11 px-3"
                    >
                      {mode[0].toUpperCase() + mode.slice(1)} mode
                      <ChevronDown />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuRadioGroup
                      value={mode}
                      onValueChange={(v) => setMode(v as ReadingMode)}
                    >
                      {modes.map((m) => (
                        <DropdownMenuRadioItem key={m} value={m} className="min-h-11 flex-col items-start justify-center gap-0 [&>span:first-child]:top-1/2 [&>span:first-child]:-translate-y-1/2">
                          <span className="capitalize">{m}</span>
                          <span className="text-xs text-muted-foreground">{MODE_HINT[m]}</span>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {/* md+: segmented chips; if they ever don't fit they scroll inside themselves, never the page. */}
              <ToggleGroup
                ref={modeGroupRef}
                type="single"
                value={mode}
                onValueChange={(v) => v && setMode(v as ReadingMode)}
                aria-label="Reading mode"
                className="hidden min-w-0 flex-1 justify-start overflow-x-auto [scrollbar-width:none] md:flex max-lg:[mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)] [&::-webkit-scrollbar]:hidden"
              >
                {modes.map((m) => (
                  <ToggleGroupItem
                    key={m}
                    value={m}
                    title={`${MODE_HINT[m]} (press ${modes.indexOf(m) + 1})`}
                    className="h-11 shrink-0 px-2.5 text-sm text-muted-foreground capitalize data-[state=on]:bg-primary data-[state=on]:text-primary-foreground lg:h-9"
                  >
                    {m}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              </>)}
              <ReaderActions
                pieceId={piece.id}
                authed={authed}
                articleRef={articleRef}
                repostCreditsRequired={!!piece.repost_credits_required}
                onShare={share}
                blocks={listenBlocks}
                initialSaved={initialSaved}
                onShowInfo={() => setMoreOpen(true)}
                modeCount={modes.length}
              />
            </div>

            <SheetContent
              side="bottom"
              className="max-h-[85vh] overflow-y-auto"
            >
              <SheetHeader>
                <SheetTitle className="sr-only">Reader Information</SheetTitle>
                <SheetDescription className="sr-only">
                  Access outline, author details, tip jar, and related pieces.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                <ReaderAside
                  piece={piece}
                  author={author}
                  headings={headings}
                  branches={branches}
                  related={related}
                  authed={authed}
                  isAuthor={viewerId === piece.author_id}
                  tipRef={tipRef}
                  onSignInRequired={() => router.push("/login")}
            sourcesCount={sourceCount}
            onShowSources={() => setSourcesOpen(true)}
                  variant="mobile-sheet"
                />
              </div>
            </SheetContent>
          </Sheet>

          <div className="mt-8 relative">
            {launchFree && bodyBlocks.some((b: any) => b.monetization_eligible) && (
              <Badge variant="secondary" className="mb-4">Free during launch</Badge>
            )}
            <ReaderBody
              blocks={bodyBlocks}
              mode={mode}
              hasAccess={hasAccess}
              is_adult={isAdult}
              has_dob={hasDob}
              highlights={[...initialHighlights, ...optimisticHighlights]}
              inlineComments={inlineComments.filter((c: any) => !c.parent_id && c.quoted_text)}
              onUnlock={piece.price_paise ? buy : subscribe}
            />
            {!hasAccess && bodyBlocks.some((b: any) => b.monetization_eligible) && (
              <PremiumTeaserOverlay 
                onSubscribe={subscribe}
                onBuy={piece.price_paise ? buy : undefined}
                pricePaise={piece.price_paise ?? undefined}
                title={piece.title}
                authorName={author?.display_name || author?.handle}
              />
            )}
          </div>

            <SubscribeDialog
              open={subscribeOpen}
              onOpenChange={setSubscribeOpen}
              authorId={piece.author_id}
              authorName={author?.display_name || author?.handle || "this author"}
            />
            {originalPiece && originalBlocks && (
              <EmbeddedRepost
                piece={originalPiece}
                author={originalAuthor ?? null}
                blocks={originalBlocks}
              />
            )}

            {hasAnySources && (
              <div className="my-8 flex justify-center">
                <Button variant="outline" size="sm" onClick={() => setSourcesOpen(true)}>
                  <BookOpen className="mr-2 size-4" />
                  View sources and citations
                </Button>
              </div>
            )}

            {/* One end-of-piece card: follow in the app, or get new pieces by email. */}
            {author && author.handle && viewerId !== piece.author_id && (
              <section className="mt-16 rounded-lg border border-border p-6" aria-labelledby="more-from">
                <h2 id="more-from" className="font-display text-2xl">
                  More from{" "}
                  <Link href={`/u/${author.handle}`} className="hover:text-primary hover:underline hover:underline-offset-4">
                    {author.display_name}
                  </Link>
                </h2>
                <p className="mt-2 text-muted-foreground">Follow to see new pieces in your feed, or get them by email.</p>
                <div className="mt-4 flex flex-wrap items-center gap-3" data-no-hovercard>
                  <FollowButton authorId={piece.author_id} authorHandle={author.handle} size="default" />
                  <Button asChild variant="outline">
                    <Link href={`/u/${author.handle}`}>See all pieces</Link>
                  </Button>
                </div>
                <div className="mt-6">
                  <SubscribeCard compact authorId={piece.author_id} authorName={author.display_name ?? author.handle} />
                </div>
              </section>
            )}

            {boosts.length > 0 && <PlatformBoostAd boosts={boosts} />}

          {rooms.length > 0 && (
            <div className="mt-12 space-y-6">
              <h2 className="font-display text-2xl text-foreground">
                Live debates
              </h2>
              {rooms.map((r) => (
                <DebateRoom
                  key={r.id}
                  roomId={r.id}
                  title={r.title}
                  prompt={r.prompt}
                  authed={authed}
                />
              ))}
            </div>
          )}

          {/* Prev / Next */}
          {(prev || next) && (
            <nav
              aria-label="More from this author"
              className="mt-16 grid gap-3 sm:grid-cols-2"
            >
              {prev && author ? (
                <Link
                  href={`/u/${author.handle}/${prev.slug}`}
                  className="surface group flex flex-col items-start rounded-md p-4 transition-colors hover:bg-accent/40"
                >
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <ChevronLeft className="size-3.5" aria-hidden /> Older
                  </p>
                  <p className="mt-1 font-display text-base text-foreground group-hover:text-primary line-clamp-2" title={prev.title}>
                    {prev.title}
                  </p>
                </Link>
              ) : (
                <span />
              )}
              {next && author ? (
                <Link
                  href={`/u/${author.handle}/${next.slug}`}
                  className="surface group flex flex-col items-start sm:items-end rounded-md p-4 transition-colors hover:bg-accent/40 sm:text-right"
                >
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    Newer <ChevronRight className="size-3.5" aria-hidden />
                  </p>
                  <p className="mt-1 font-display text-base text-foreground group-hover:text-primary line-clamp-2" title={next.title}>
                    {next.title}
                  </p>
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}

          {piece.sponsorship_enabled && (
            <PublicSponsorCard pieceId={piece.id} />
          )}

          {threadPopoverState.open && (
            <InlineThreadPopover
              anchorRect={threadPopoverState.anchorRect}
              pieceId={piece.id}
              pieceAuthorId={piece.author_id}
              parentComment={threadPopoverState.parentComment}
              replies={
                threadPopoverState.parentComment
                  ? inlineComments.filter(
                      (c: any) => c.parent_id === threadPopoverState.parentComment.id
                    )
                  : []
              }
              quotedText={threadPopoverState.quotedText}
              viewerId={viewerId}
              onClose={() => {
                setThreadPopoverState((s) => ({ ...s, open: false }))
                setInlineComments(prev => prev.filter(c => c.id !== "temp-new-comment"))
              }}
              onCommentPosted={(newComment: any) => {
                router.refresh()
                if (newComment) {
                  setInlineComments((prev) => {
                    if (prev.find(c => c.id === newComment.id)) return prev
                    return [...prev, newComment]
                  })
                }
                setThreadPopoverState((s) => {
                  if (!s.parentComment && newComment && !newComment.parent_id) {
                    return { ...s, parentComment: newComment }
                  }
                  return s
                })
              }}
              onCommentDeleted={() => {
                router.refresh()
                setThreadPopoverState((s) => ({ ...s, open: false }))
              }}
            />
          )}

          <FootnotesSection footnotes={footnotes} />
        </article>

        <div className="mt-12 lg:hidden">
          <ReaderAside
            piece={piece}
            author={author}
            headings={headings}
            branches={branches}
            related={related}
            authed={authed}
            isAuthor={viewerId === piece.author_id}
            tipRef={tipRef}
            onSignInRequired={() => router.push("/login")}
            sourcesCount={sourceCount}
            onShowSources={() => setSourcesOpen(true)}
            variant="mobile-footer"
          />
        </div>

        <div
          className="custom-scrollbar sticky top-24 hidden max-h-[calc(100vh-6rem)] self-start overflow-y-auto pb-8 lg:block"
        >
          <ReaderAside
            piece={piece}
            author={author}
            headings={headings}
            branches={branches}
            related={related}
            authed={authed}
            isAuthor={viewerId === piece.author_id}
            tipRef={tipRef}
            onSignInRequired={() => router.push("/login")}
            sourcesCount={sourceCount}
            onShowSources={() => setSourcesOpen(true)}
          />
        </div>
      </main>
      </ClapProvider>

      <SourcesSheet 
        open={sourcesOpen} 
        onOpenChange={setSourcesOpen} 
        sources={aggregatedSources} 
      />
      
      {author && piece.author_id && author.handle && (
        <SubscribeModal
          articleRef={articleRef}
          authorId={piece.author_id} 
          authorHandle={author.handle} 
          authorName={author.display_name ?? author.handle} 
          authorAvatar={author.avatar_url}
        />
      )}

      {author && (
        <Dialog open={showFollowDialog} onOpenChange={setShowFollowDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="gap-2">
              <DialogTitle className="font-display text-2xl">
                Follow {author.display_name}?
              </DialogTitle>
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-border p-3">
                <Avatar className="size-12">
                  {author.avatar_url && <AvatarImage src={author.avatar_url} />}
                  <AvatarFallback className="bg-accent text-lg text-accent-foreground">
                    {author.display_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col text-left">
                  <span className="font-medium text-foreground">{author.display_name}</span>
                  <span className="text-xs text-muted-foreground">@{author.handle}</span>
                  {author.bio && <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">{author.bio}</span>}
                </div>
              </div>
              <DialogDescription className="mt-2">
                New pieces from {author.display_name} will show up in your feed.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex items-center justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setShowFollowDialog(false)}>
                Maybe later
              </Button>
              <div onClick={() => setShowFollowDialog(false)}>
                <FollowButton authorId={piece.author_id} authorHandle={author.handle} />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Headphones,
  Bookmark,
  BookmarkCheck,
  Repeat2,
  Undo2,
  Share2,
  Square,
  MessageCircle,
  Flag,
  ListTree,
  MoreHorizontal,
  SlidersHorizontal,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  savePiece,
  unsavePiece,
  listMyCollections,
  ensurePersonalCollection,
  repostPiece,
} from "@/actions/content"
import { Input } from "@/components/ui/input"
import { createCollection, consumeListeningCredit } from "@/actions/monetization"
import { ReportButton } from "./report-button"
import { CommentsSheet } from "./comments-sheet"
import { ClapButton, useClaps } from "./clap-button"

type ListenBlock = {
  type?: string
  semantic_role?: string | null
  content?: Record<string, unknown>
}

type Props = {
  pieceId: string
  authed: boolean
  articleRef: React.RefObject<HTMLElement | null>
  repostCreditsRequired: boolean
  onShare: () => void
  /** Optional structured blocks — enables tone-aware reading per semantic role. */
  blocks?: ListenBlock[]
  initialSaved: boolean
  viewerId?: string | null
  pieceAuthorId?: string | null
  /** Opens the outline/author sheet (shown in the More menu below lg, where the aside is hidden). */
  onShowInfo?: () => void
  /** How many reading modes the piece offers; number keys switch between them. */
  modeCount?: number
}

// 44px touch targets below lg; icon-only below sm.
const ACTION = "h-11 min-w-11 px-2 text-muted-foreground hover:text-foreground sm:px-3 lg:h-9 lg:min-w-9"
const LABEL = "hidden md:inline lg:hidden xl:inline" // only where the mode chips still fit beside them
const ITEM = "min-h-11 w-full lg:min-h-9"

// Per-role voice "tone" — rate (pace), pitch (intonation), trailing pause (ms)
const TONE: Record<string, { rate: number; pitch: number; pause: number }> = {
  heading: { rate: 0.92, pitch: 1.1, pause: 500 },
  thesis: { rate: 0.85, pitch: 1.0, pause: 600 },
  evidence: { rate: 1.0, pitch: 0.95, pause: 250 },
  counter: { rate: 0.96, pitch: 1.05, pause: 350 },
  question: { rate: 0.92, pitch: 1.15, pause: 400 },
  quote: { rate: 0.88, pitch: 0.92, pause: 450 },
  callout: { rate: 0.96, pitch: 1.05, pause: 350 },
  footnote: { rate: 1.1, pitch: 0.9, pause: 200 },
  citation: { rate: 1.05, pitch: 0.92, pause: 250 },
  exercise: { rate: 0.94, pitch: 1.05, pause: 400 },
  paragraph: { rate: 1.0, pitch: 1.0, pause: 250 },
}

// ... TONE and textOf ...
export function textOf(c: Record<string, unknown> | undefined): string {
  if (!c) return ""
  if (typeof c.text === "string") return c.text
  if (typeof c.html === "string")
    return c.html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  return ""
}

export function ReaderActions({
  pieceId,
  authed,
  articleRef,
  repostCreditsRequired,
  onShare,
  blocks,
  viewerId,
  pieceAuthorId,
  initialSaved,
  onShowInfo,
  modeCount = 0,
}: Props) {
  const router = useRouter()
  const claps = useClaps()
  const saveFn = savePiece
  const unsaveFn = unsavePiece
  const listCol = listMyCollections
  const ensurePersonal = ensurePersonalCollection
  const repostFn = repostPiece

  const [savedState, setSavedState] = useState(initialSaved)
  const saved = authed ? savedState : false
  const isOwn = !!viewerId && viewerId === pieceAuthorId
  const [saveOpen, setSaveOpen] = useState(false)
  const [collections, setCollections] = useState<
    Array<{ id: string; title: string; is_personal: boolean }>
  >([])
  const [pickColl, setPickColl] = useState<string>("personal")
  const [newCollectionName, setNewCollectionName] = useState("")

  const [repostOpen, setRepostOpen] = useState(false)
  const [addCredits, setAddCredits] = useState(true)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)


  // TTS
  const [speaking, setSpeaking] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>("")
  const [playbackSpeed, setPlaybackSpeed] = useState([1])

  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices()
      setVoices(v)
      if (v.length > 0 && !selectedVoiceURI) {
        // Prefer a good English voice if available
        const defaultVoice = v.find(voice => voice.lang.includes('en-') && voice.name.includes('Google')) || v[0]
        setSelectedVoiceURI(defaultVoice.voiceURI)
      }
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      loadVoices()
      window.speechSynthesis.onvoiceschanged = loadVoices
    }
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null
      }
    }
  }, [selectedVoiceURI])

  // Comments
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [listenSettingsOpen, setListenSettingsOpen] = useState(false)

  useEffect(() => {
    // setSavedState(initialSaved)
  }, [initialSaved])

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    },
    []
  )

  const requireAuth = () => {
    if (!authed) {
      router.push("/login")
      return false
    }
    return true
  }

  const toggleListen = async () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Listen isn't supported in this browser")
      return
    }
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    if (!requireAuth()) return

    if (viewerId !== pieceAuthorId) {
      setBusy(true)
      try {
        const res = await consumeListeningCredit()
        if (!res.success) {
          toast.error("Insufficient credits to listen. You need 1 credit.")
          setBusy(false)
          return
        }
        toast.success(`Used 1 listening credit. (${res.remainingCredits} remaining)`)
      } catch {
        toast.error("Failed to verify listening credits.")
        setBusy(false)
        return
      }
      setBusy(false)
    }

    // Build a queue of (text, tone, uid) segments. Prefer structured blocks (tone-aware);
    // fall back to flat DOM text if no blocks are provided.
    type Seg = {
      text: string
      tone: { rate: number; pitch: number; pause: number }
      uid?: string
    }
    const queue: Seg[] = []
    if (blocks && blocks.length) {
      for (const b of blocks) {
        const role = (b.semantic_role || b.type || "paragraph").toString()
        const tone = TONE[role] ?? TONE.paragraph
        const t = textOf(b.content).trim()
        if (t) queue.push({ text: t, tone, uid: (b as any).uid || (b as any).id })
      }
    }
    
    if (!queue.length) {
      const el = articleRef.current
      if (el) {
        const t = el.innerText.slice(0, 30000).trim()
        if (t) queue.push({ text: t, tone: TONE.paragraph })
      }
    }

    if (!queue.length) {
      toast.error("No readable text found on this page")
      return
    }
    setSpeaking(true)
    window.speechSynthesis.cancel()

    // clear any previous highlights
    document.querySelectorAll('.tts-highlight').forEach(el => el.classList.remove('tts-highlight', 'ring-2', 'ring-primary', 'bg-primary/5'))

    setTimeout(() => {
      let i = 0
      const next = () => {
        // clear previous block highlight
        document.querySelectorAll('.tts-highlight').forEach(el => el.classList.remove('tts-highlight', 'ring-2', 'ring-primary', 'bg-primary/5'))

        if (i >= queue.length) {
          setSpeaking(false)
          return
        }
        const seg = queue[i++]
        const u = new SpeechSynthesisUtterance(seg.text)
        
        u.rate = seg.tone.rate * playbackSpeed[0]
        u.pitch = seg.tone.pitch
        
        const voice = voices.find(v => v.voiceURI === selectedVoiceURI)
        if (voice) {
          u.voice = voice
        }

        if (seg.uid) {
          const el = document.getElementById(`block-${seg.uid}`)
          if (el) {
            el.classList.add('tts-highlight', 'ring-2', 'ring-primary', 'bg-primary/5')
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }

        // Advanced Highlights: using onboundary to track word by word if possible.
        // It's hard to highlight specific text without wrapping spans, but we can at least
        // smoothly scroll and keep the block highlighted.
        u.onboundary = () => {
          // if (e.name === 'word') {
          //    In a more complex implementation, we'd wrap text in spans and use e.charIndex.
          //    For now, the block highlight is sufficient for MVP.
          // }
        }

        u.onend = () => window.setTimeout(next, seg.tone.pause)
        u.onerror = () => {
           document.querySelectorAll('.tts-highlight').forEach(el => el.classList.remove('tts-highlight', 'ring-2', 'ring-primary', 'bg-primary/5'))
           setSpeaking(false)
        }
        window.speechSynthesis.speak(u)
      }
      next()
    }, 50)
  }

  const openSave = async () => {
    if (!requireAuth()) return
    if (saved) {
      await unsaveFn({ data: { content_object_id: pieceId } })
      setSavedState(false)
      toast.success("Removed from saved")
      return
    }
    try {
      const cols = await listCol()
      setCollections(cols)
      setPickColl("personal")
      setSaveOpen(true)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const doSave = async () => {
    setBusy(true)
    try {
      let collection_id: string | null = null
      if (pickColl !== "personal") collection_id = pickColl
      else {
        const { id } = await ensurePersonal()
        collection_id = id
      }
      await saveFn({ data: { content_object_id: pieceId, collection_id } })
      setSavedState(true)
      setSaveOpen(false)
      toast.success("Saved", {
        action: { label: "View list", onClick: () => router.push(`/collections/${collection_id}`) },
      })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const createCollectionAndSave = async () => {
    setBusy(true)
    try {
      const { id: collection_id } = await createCollection({
        data: { title: newCollectionName.trim() || "Untitled Collection" },
      })
      await saveFn({ data: { content_object_id: pieceId, collection_id } })
      setSavedState(true)
      setSaveOpen(false)
      toast.success("Saved to new collection!", {
        action: { label: "View", onClick: () => router.push(`/collections/${collection_id}`) },
      })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const openRepost = () => {
    if (!requireAuth()) return
    setAddCredits(true)
    setNote("")
    setRepostOpen(true)
  }

  const doRepost = async () => {
    setBusy(true)
    try {
      const r = await repostFn({
        data: {
          original_piece_id: pieceId,
          add_credits: repostCreditsRequired ? true : addCredits,
          note: note.trim() || undefined,
        },
      })
      setRepostOpen(false)
      toast.success(r.credited ? "Reposted with credit" : "Reposted")
      router.push(`/studio/drafts/${r.id}`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex shrink-0 items-center sm:gap-1">
        {speaking && (
          <Button variant="ghost" onClick={toggleListen} aria-label="Stop listening" title="Stop listening" className={ACTION + " text-primary"}>
            <Square />
          </Button>
        )}
        <ClapButton
          disabled={!!viewerId && viewerId === pieceAuthorId}
          className={buttonVariants({ variant: "ghost", className: ACTION })}
        />
        <Button
          variant="ghost"
          onClick={openSave}
          aria-label={saved ? "Saved, remove from reading list" : "Save"}
          title={saved ? "Remove from saved" : "Save to reading list"}
          className={ACTION}
        >
          {saved ? <BookmarkCheck className="text-primary" /> : <Bookmark />}
          <span className={speaking ? "hidden" : LABEL}>{saved ? "Saved" : "Save"}</span>
        </Button>
        <Button variant="ghost" onClick={onShare} aria-label="Share this piece" title="Copy link to share" className={ACTION}>
          <Share2 />
          <span className={speaking ? "hidden" : LABEL}>Share</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" aria-label="More actions" title="More actions" className={ACTION}>
              <MoreHorizontal />
              <span className={speaking ? "hidden" : LABEL}>More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={toggleListen} disabled={busy} className={ITEM}>
              {speaking ? <Square /> : <Headphones />}
              {speaking ? "Stop listening" : "Listen"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setListenSettingsOpen(true)} className={ITEM}>
              <SlidersHorizontal /> Listen settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setCommentsOpen(true)} className={ITEM}>
              <MessageCircle /> Responses
            </DropdownMenuItem>
            {!isOwn && (
              <DropdownMenuItem onSelect={openRepost} className={ITEM}>
                <Repeat2 /> Repost
              </DropdownMenuItem>
            )}
            {claps && claps.mine > 0 && (
              <DropdownMenuItem onSelect={claps.undo} className={ITEM}>
                <Undo2 /> Undo claps ({claps.mine})
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onShowInfo && (
              <DropdownMenuItem onSelect={onShowInfo} className={ITEM + " lg:hidden"}>
                <ListTree /> Outline and more
              </DropdownMenuItem>
            )}
            {!isOwn && (
              <DropdownMenuItem
                onSelect={() => {
                  if (requireAuth()) setReportOpen(true)
                }}
                className={ITEM}
              >
                <Flag /> Report
              </DropdownMenuItem>
            )}
            {modeCount > 1 && (
              <p className="hidden px-2 pt-2 pb-1 text-xs text-muted-foreground lg:block">
                Tip: press <kbd className="rounded bg-muted px-1">1</kbd>–<kbd className="rounded bg-muted px-1">{modeCount}</kbd> to switch reading modes.
              </p>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ReportButton pieceId={pieceId} authed={authed} open={reportOpen} onOpenChange={setReportOpen} />

      {/* Listen settings dialog */}
      <Dialog open={listenSettingsOpen} onOpenChange={setListenSettingsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Listen settings</DialogTitle>
            <DialogDescription>Voice and speed for reading this piece aloud.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Voice</Label>
              <Select value={selectedVoiceURI} onValueChange={setSelectedVoiceURI}>
                <SelectTrigger>
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent>
                  {voices.map((v) => (
                    <SelectItem key={v.voiceURI} value={v.voiceURI}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Speed</Label>
                <span className="font-mono text-sm">{playbackSpeed[0]}x</span>
              </div>
              <Slider min={0.5} max={4.5} step={0.25} value={playbackSpeed} onValueChange={setPlaybackSpeed} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setListenSettingsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save-to-collection dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save to reading list</DialogTitle>
            <DialogDescription>
              Pick where this piece should land.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Collection</Label>
            <Select value={pickColl} onValueChange={setPickColl}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">My Saved (private)</SelectItem>
                {collections
                  .filter((c) => !c.is_personal)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                <SelectItem value="new">+ Create New Collection</SelectItem>
              </SelectContent>
            </Select>
            {pickColl === "new" && (
              <div>
                <Label htmlFor="newCollection">Collection Name</Label>
                <Input
                  id="newCollection"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="e.g. Favorite Pieces"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            {pickColl !== "new" ? (
              <Button onClick={doSave} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
            ) : (
              <Button onClick={createCollectionAndSave} disabled={busy}>
                {busy ? "Creating and saving…" : "Create and save"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repost dialog */}
      <Dialog open={repostOpen} onOpenChange={setRepostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repost this piece</DialogTitle>
            <DialogDescription>
              {repostCreditsRequired
                ? "The author requires credit on reposts — a credit block will be added automatically."
                : "Add an optional note. You decide whether to credit the original author."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!repostCreditsRequired && (
              <div className="flex items-center justify-between">
                <Label htmlFor="credits">Credit the original author</Label>
                <Switch
                  id="credits"
                  checked={addCredits}
                  onCheckedChange={setAddCredits}
                />
              </div>
            )}
            <div>
              <Label htmlFor="note">Your note (optional)</Label>
              <Textarea
                id="note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why are you sharing this?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRepostOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doRepost} disabled={busy}>
              {busy ? "Reposting…" : "Repost as draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CommentsSheet
        pieceId={pieceId}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        authed={authed}
        viewerId={viewerId}
        pieceAuthorId={pieceAuthorId}
      />
    </>
  )
}

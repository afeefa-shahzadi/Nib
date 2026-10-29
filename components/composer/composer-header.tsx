/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Eye, Save, MoreHorizontal, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { MODES, MODE_LABEL, type ReadingMode } from "./types"

interface ComposerHeaderProps {
  status: string
  slug: string
  saving: boolean
  savedAgo: string
  previewMode: ReadingMode | null
  setPreviewMode: (mode: ReadingMode | null) => void
  readerPreview: boolean
  setReaderPreview: (value: boolean) => void
  heatmapEnabled: boolean
  setHeatmapEnabled: (value: boolean) => void
  setShowMeta: (value: boolean) => void
  setShowSchedule: (value: boolean) => void
  openInspector: () => void
  setInspectorTab: (tab: "inspector" | "archive") => void
  onShowMinimap: () => void
  onSave: () => void
  onPublish: () => void
  onDelete: () => Promise<void>
  titleText: string
  pieceId: string
  authorHandle: string
  onStartTour?: () => void
  onUndo?: () => void
  onRedo?: () => void
}

import { dispatchNewsletter } from "@/actions/newsletter"
import { toast } from "sonner"
import { Mail, HelpCircle } from "lucide-react"

export function ComposerHeader({
  status,
  slug,
  saving,
  savedAgo,
  previewMode,
  setPreviewMode,
  readerPreview,
  setReaderPreview,
  heatmapEnabled,
  setHeatmapEnabled,
  setShowMeta,
  setShowSchedule,
  openInspector,
  setInspectorTab,
  onShowMinimap,
  onSave,
  onPublish,
  onDelete,
  titleText,
  pieceId,
  authorHandle,
  onStartTour,
  onUndo,
  onRedo,
}: ComposerHeaderProps) {
  const router = useRouter()
  const [sending, setSending] = useState(false)

  const handleSendNewsletter = async () => {
    if (sending) return
    setSending(true)
    try {
      const res = await dispatchNewsletter({ data: { pieceId } })
      if (res?.success) {
        const n = res.recipientsCount ?? 0
        const q = res.queuedCount ?? 0
        const lost = res.lostCount ?? 0
        if (lost > 0)
          toast.error(
            `Sent to ${n}${q ? `, ${q} queued for later` : ""}. ${lost} couldn't be sent or queued — try sending again later.`
          )
        else toast.success(
          q > 0
            ? `Sent to ${n}. ${q} more will go out automatically when the email limit resets.`
            : `Newsletter sent to ${n} ${n === 1 ? "reader" : "readers"}.`
        )
      } else {
        // Server returns { success: false } for "no recipients" / "not
        // published" — these used to surface as a false "sent to undefined".
        toast.error(res?.error || "Couldn't send the newsletter.")
      }
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : "Failed to send newsletter")
    } finally {
      setSending(false)
    }
  }

  return (
    <header className="hairline-b flex h-14 shrink-0 items-center justify-between gap-3 px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/studio/drafts")}
        >
          <ChevronLeft className="size-4 sm:mr-1" /><span className="sr-only sm:not-sr-only">Drafts</span>
        </Button>

        <div className="flex items-center gap-1 border-l border-border pl-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-11 text-muted-foreground sm:size-8"
            onClick={onUndo}
            title="Undo structural change"
            aria-label="Undo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden size-8 text-muted-foreground sm:inline-flex"
            onClick={onRedo}
            title="Redo structural change"
            aria-label="Redo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
          </Button>
        </div>

        <span className="ml-1 hidden truncate text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">
          {status} · /{slug}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          role="status"
          aria-live="polite"
          aria-label={saving ? "Saving…" : `Saved · ${savedAgo}`}
          className="flex items-center text-xs text-muted-foreground"
        >
          <span
            aria-hidden
            className={`size-2 rounded-full sm:hidden ${saving ? "animate-pulse bg-muted-foreground" : "bg-primary"}`}
          />
          <span aria-hidden className="hidden max-w-25 truncate sm:inline md:max-w-none">
            {saving ? "Saving…" : `Saved · ${savedAgo}`}
          </span>
        </span>
        <div className="hairline-l mx-1 h-6" />
        <Button
          size="sm"
          variant={readerPreview ? "default" : "ghost"}
          onClick={() => setReaderPreview(!readerPreview)}
          title="Toggle reader preview"
          className="hidden lg:inline-flex"
        >
          {readerPreview ? "Edit" : "Preview"}
        </Button>
        <Button size="sm" variant="outline" onClick={onSave}>
          <Save className="mr-1 size-4" /> Save
        </Button>
        <Button size="sm" onClick={onPublish} title="Cmd/Ctrl + Enter">
          {status === "published" ? "Unpublish" : "Publish"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button id="tour-more" size="icon" variant="ghost" aria-label="More actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {status === "published" && (
              <DropdownMenuItem
                onSelect={() =>
                  window.open(`/u/${authorHandle || "_"}/${slug}`, "_blank")
                }
              >
                Open reader page
              </DropdownMenuItem>
            )}
            <ConfirmDialog
              trigger={
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  disabled={status !== "published" || sending}
                >
                  <Mail className="mr-2 size-4" /> Send via Email
                </DropdownMenuItem>
              }
              title="Email this piece to your followers?"
              description="Sends the published piece to every follower and subscriber with an email on file. This can't be unsent."
              confirmLabel="Send email"
              onConfirm={handleSendNewsletter}
            />
            {onStartTour && (
                <DropdownMenuItem onSelect={onStartTour}>
                  <HelpCircle className="mr-2 size-4" /> Restart Tour
                </DropdownMenuItem>
              )}
            
            {/* Secondary actions: kept out of the top bar so it stays at six */}
            <DropdownMenuItem className="sm:hidden" onSelect={onRedo}>
              Redo
            </DropdownMenuItem>
            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Eye className="mr-2 size-4" /> Reading Mode
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={() => setPreviewMode(null)}>
                    All modes {previewMode === null && "✓"}
                  </DropdownMenuItem>
                  {MODES.map((m) => (
                    <DropdownMenuItem key={m} onSelect={() => setPreviewMode(m)}>
                      {MODE_LABEL[m]} {previewMode === m && "✓"}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuItem
             
              onSelect={(e) => { e.preventDefault(); setReaderPreview(!readerPreview); }}
            >
              {readerPreview ? "Disable Preview" : "Preview Mode"}
            </DropdownMenuItem>
            <DropdownMenuItem
             
              onSelect={() => setShowMeta(true)}
            >
              Meta
            </DropdownMenuItem>
            <DropdownMenuItem
             
              onSelect={onShowMinimap}
            >
              Minimap
            </DropdownMenuItem>
            <DropdownMenuItem
             
              onSelect={(e) => { e.preventDefault(); setHeatmapEnabled(!heatmapEnabled); }}
            >
              {heatmapEnabled ? "Disable Heatmap" : "Heatmap"}
            </DropdownMenuItem>
            <DropdownMenuItem
             
              onSelect={() => setShowSchedule(true)}
            >
              Schedule
            </DropdownMenuItem>
            <DropdownMenuItem
             
              onSelect={() => {
                openInspector()
                setInspectorTab("archive")
              }}
            >
              Archive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <ConfirmDialog
              trigger={
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" /> Delete piece
                </DropdownMenuItem>
              }
              title="Delete this piece?"
              description="This permanently removes the piece, all of its blocks, and any branches. Cannot be undone."
              destructive
              confirmLabel="Delete piece"
              typedConfirm={titleText.trim().slice(0, 24) || "delete"}
              onConfirm={onDelete}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

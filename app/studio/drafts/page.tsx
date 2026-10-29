"use client"

import { StudioSkeleton } from "@/components/studio/studio-skeleton"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { DraftPiece } from "@/lib/types/content"
import { PIECE_STATUS_ICON } from "@/lib/content/studio/data"
import {
  listMyPieces,
  createPiece,
  importMarkdown,
  bulkUpdatePieces,
  bulkDeletePieces,
} from "@/actions/content"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  Plus,
  Upload,
  FileText,
  Trash2,
  Pencil,
  CheckSquare,
  Square,
  Globe,
  Archive,
  X,
  RotateCcw,
  MoreHorizontal,
} from "lucide-react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

export default function DraftsPage() {
  const router = useRouter()
  const listFn = listMyPieces
  const createFn = createPiece
  const importFn = importMarkdown
  const bulkUpdateFn = bulkUpdatePieces
  const bulkDeleteFn = bulkDeletePieces

  const q = useQuery({ queryKey: ["my-pieces"], queryFn: () => listFn() })
  const pieces: DraftPiece[] = (q.data ?? []) as DraftPiece[]

  const [newTitle, setNewTitle] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importTitle, setImportTitle] = useState("")
  const [importMd, setImportMd] = useState("")
  const [importing, setImporting] = useState(false)
  const [showMigrate, setShowMigrate] = useState(false)
  const [migrateUrl, setMigrateUrl] = useState("")
  const [migrating, setMigrating] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [search, setSearch] = useState("")

  const create = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const piece = await createFn({ data: { title: newTitle.trim() } })
      toast.success("Draft created")
      setNewTitle("")
      router.push(`/studio/drafts/${piece.id}`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const importDraft = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!importTitle.trim() || !importMd.trim()) return
    setImporting(true)
    try {
      const piece = await importFn({
        data: { title: importTitle.trim(), markdown: importMd },
      })
      toast.success("Imported")
      setShowImport(false)
      setImportTitle("")
      setImportMd("")
      router.push(`/studio/drafts/${piece.id}`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setImporting(false)
    }
  }

  // Substack/Medium zip + single-URL import go through /api/import (binary
  // upload + server-side fetch; a server action can't take the file cleanly).
  const runImport = async (body: FormData) => {
    setMigrating(true)
    try {
      const res = await fetch("/api/import", { method: "POST", body })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Import failed.")
        return
      }
      toast.success(
        `Imported ${data.created} ${data.created === 1 ? "draft" : "drafts"}.`
      )
      setShowMigrate(false)
      setMigrateUrl("")
      await q.refetch()
      if (data.created === 1 && data.drafts?.[0]?.id) {
        router.push(`/studio/drafts/${data.drafts[0].id}`)
      }
    } catch {
      toast.error("Import failed.")
    } finally {
      setMigrating(false)
    }
  }

  const migrateFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append("file", file)
    runImport(fd)
    e.target.value = ""
  }

  const migrateFromUrl = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!migrateUrl.trim()) return
    const fd = new FormData()
    fd.append("url", migrateUrl.trim())
    runImport(fd)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const name = file.name.replace(/\.md$/i, '')
    if (!importTitle) setImportTitle(name)
    
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (typeof ev.target?.result === "string") {
        setImportMd(ev.target.result)
      }
    }
    reader.readAsText(file)
  }

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) {
        n.delete(id)
      } else {
        n.add(id)
      }
      return n
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map((p) => p.id)))
  }

  const bulkPublish = async () => {
    try {
      await bulkUpdateFn({
        data: { ids: [...selected], patch: { status: "published" } },
      })
      toast.success("Published")
      setSelected(new Set())
      q.refetch()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const bulkArchive = async () => {
    try {
      await bulkUpdateFn({
        data: { ids: [...selected], patch: { status: "archived" } },
      })
      toast.success("Archived")
      setSelected(new Set())
      q.refetch()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const bulkTrash = async () => {
    try {
      await bulkUpdateFn({
        data: { ids: [...selected], patch: { status: "deleted" } },
      })
      toast.success("Sent to recycle bin")
      setSelected(new Set())
      q.refetch()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const bulkRestore = async () => {
    try {
      await bulkUpdateFn({
        data: { ids: [...selected], patch: { status: "draft" } },
      })
      toast.success("Restored to drafts")
      setSelected(new Set())
      q.refetch()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const bulkDelete = async () => {
    try {
      await bulkDeleteFn({ data: { ids: [...selected] } })
      toast.success("Permanently deleted")
      setSelected(new Set())
      q.refetch()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const updateSinglePiece = async (id: string, status: string) => {
    try {
      await bulkUpdateFn({ data: { ids: [id], patch: { status } } })
      toast.success(status === "deleted" ? "Moved to bin" : `Status updated to ${status}`)
      q.refetch()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const deleteSinglePiece = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this? This cannot be undone.")) return
    try {
      await bulkDeleteFn({ data: { ids: [id] } })
      toast.success("Permanently deleted")
      q.refetch()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const filtered = pieces.filter((p) => {
    if (filterStatus === "all") {
      return p.status !== "deleted" && (!search || p.title.toLowerCase().includes(search.toLowerCase()))
    }
    const matchStatus = p.status === filterStatus
    const matchSearch =
      !search || p.title.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })

  return (
    <div className="mx-auto w-full max-w-350 p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Studio
          </p>
          <h1 className="font-display text-3xl text-foreground">Pieces</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pieces.length} total ·{" "}
            {pieces.filter((p) => p.status === "published").length} published
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? (
              <>
                <X className="mr-2 size-4" /> Close
              </>
            ) : (
              <>
                <Plus className="mr-2 size-4" /> Create piece
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImport(!showImport)}
          >
            {showImport ? (
              <>
                <X className="mr-2 size-4" /> Close Import
              </>
            ) : (
              <>
                <Upload className="mr-2 size-4" /> Import markdown
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMigrate(!showMigrate)}
          >
            {showMigrate ? (
              <>
                <X className="mr-2 size-4" /> Close
              </>
            ) : (
              <>
                <Globe className="mr-2 size-4" /> Import from Substack/Medium
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Create new */}
      {showCreate && (
        <form
          onSubmit={create}
          className="surface mb-6 flex gap-3 rounded-md border border-border/60 p-4"
        >
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New piece title…"
            className="flex-1 min-w-0"
          />
          <Button type="submit" disabled={creating || !newTitle.trim()}>
            <Plus className="mr-2 size-4" />
            {creating ? "Creating…" : "Create"}
          </Button>
        </form>
      )}

      {/* Import markdown */}
      {showImport && (
        <form
          onSubmit={importDraft}
          className="surface mb-6 space-y-3 rounded-md border border-border/60 p-5"
        >
          <p className="font-display text-lg">Import from markdown</p>
          <div className="min-w-0">
            <Label>Upload a <span className="text-primary bg-primary/10 px-1 rounded-sm font-semibold">.md</span> file</Label>
            <Input
              type="file"
              accept=".md,text/markdown"
              onChange={handleFileUpload}
              className="mt-1"
            />
          </div>

          <div className="flex items-center gap-4 py-2">
            <div className="h-px flex-1 bg-border/60"></div>
            <span className="text-xs tracking-[0.2em] text-muted-foreground uppercase">or paste manually</span>
            <div className="h-px flex-1 bg-border/60"></div>
          </div>
          <div className="min-w-0">
            <Label>Title</Label>
            <Input
              required
              value={importTitle}
              onChange={(e) => setImportTitle(e.target.value)}
            />
          </div>
          <div className="min-w-0">
            <Label>Markdown content</Label>
            <Textarea
              required
              rows={8}
              value={importMd}
              onChange={(e) => setImportMd(e.target.value)}
              placeholder="Paste your markdown here…"
              className="font-mono text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={importing}>
              {importing ? "Importing…" : "Import"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowImport(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Import from Substack / Medium / URL */}
      {showMigrate && (
        <form
          onSubmit={migrateFromUrl}
          className="surface mb-6 space-y-4 rounded-md border border-border/60 p-5"
        >
          <p className="font-display text-lg">Bring your writing over</p>
          <div className="min-w-0">
            <Label>
              Upload a Substack or Medium export{" "}
              <span className="text-primary bg-primary/10 px-1 rounded-sm font-semibold">
                .zip
              </span>
            </Label>
            <Input
              type="file"
              accept=".zip,application/zip"
              onChange={migrateFile}
              disabled={migrating}
              className="mt-1"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Substack: Settings → Exports. Medium: Settings → Download your
              information. Every post becomes a draft you can edit before
              publishing.
            </p>
          </div>

          <div className="flex items-center gap-4 py-1">
            <div className="h-px flex-1 bg-border/60"></div>
            <span className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
              or one article by URL
            </span>
            <div className="h-px flex-1 bg-border/60"></div>
          </div>

          <div className="flex gap-2 min-w-0">
            <Input
              value={migrateUrl}
              onChange={(e) => setMigrateUrl(e.target.value)}
              placeholder="https://author.substack.com/p/my-post"
              className="flex-1 min-w-0"
              disabled={migrating}
            />
            <Button type="submit" disabled={migrating || !migrateUrl.trim()}>
              {migrating ? "Importing…" : "Import"}
            </Button>
          </div>
          {migrating && (
            <p className="text-xs text-muted-foreground">
              Importing — large exports can take a moment…
            </p>
          )}
        </form>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pieces…"
          className="max-w-60"
        />
        <div className="flex overflow-hidden rounded-md border border-border">
          {["all", "draft", "published", "archived", "deleted"].map((s) => (
            <button
              key={s}
              onClick={() => {
                setFilterStatus(s)
                setSelected(new Set())
              }}
              className={`px-3 py-1.5 text-xs capitalize ${filterStatus === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="surface-elevated mb-4 flex items-center gap-2 md:gap-3 rounded-md p-2 md:p-3">
          <span className="text-sm text-muted-foreground mr-auto lg:mr-0">
            {selected.size} selected
          </span>
          {filterStatus === "deleted" ? (
            <>
              <Button size="sm" variant="outline" onClick={bulkRestore} className="px-2 md:px-3">
                <RotateCcw className="size-4 md:mr-2 md:size-3" /> <span className="hidden md:inline">Restore</span>
              </Button>
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="destructive" className="px-2 md:px-3">
                    <Trash2 className="size-4 md:mr-1 md:size-3" /> <span className="hidden md:inline">Permanently Delete</span>
                  </Button>
                }
                title={`Permanently delete ${selected.size} piece${selected.size > 1 ? "s" : ""}?`}
                description="This cannot be undone."
                destructive
                confirmLabel="Delete forever"
                onConfirm={bulkDelete}
              />
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={bulkPublish} className="px-2 lg:px-3">
                <Globe className="size-4 lg:mr-2 lg:size-3" /> <span className="hidden lg:inline">Publish</span>
              </Button>
              <Button size="sm" variant="outline" onClick={bulkArchive} className="px-2 lg:px-3">
                <Archive className="size-4 lg:mr-2 lg:size-3" /> <span className="hidden lg:inline">Archive</span>
              </Button>
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="outline" className="px-2 lg:px-3">
                    <Trash2 className="size-4 lg:mr-1 lg:size-3" /> <span className="hidden lg:inline">Delete</span>
                  </Button>
                }
                title={`Move ${selected.size} piece${selected.size > 1 ? "s" : ""} to recycle bin?`}
                description="You can restore them later from the 'deleted' tab."
                destructive
                confirmLabel="Move to bin"
                onConfirm={bulkTrash}
              />
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
            className="px-2 md:px-3"
          >
            <X className="size-4 md:mr-1 md:size-3 md:hidden" /> <span className="hidden md:inline">Clear</span>
          </Button>
        </div>
      )}

      {/* Pieces list */}
      {q.isLoading ? (
        <StudioSkeleton header={false} />
      ) : filtered.length === 0 ? (
        <div className="surface rounded-md py-16 text-center">
          <FileText className="mx-auto mb-3 size-8 text-muted-foreground/40" />
          <p className="text-muted-foreground">
            {search || filterStatus !== "all"
              ? "No pieces match."
              : "No pieces yet. Create your first one above."}
          </p>
        </div>
      ) : (
        <div className="surface divide-y divide-border rounded-md">
          {/* Select all */}
          <div className="flex items-center gap-3 px-4 py-2">
            <button
              onClick={toggleAll}
              className="text-muted-foreground hover:text-foreground"
              title={
                selected.size === filtered.length
                  ? "Deselect all"
                  : "Select all"
              }
            >
              {selected.size === filtered.length && filtered.length > 0 ? (
                <CheckSquare className="size-4" />
              ) : (
                <Square className="size-4" />
              )}
            </button>
            <span className="text-xs text-muted-foreground">
              {filtered.length} piece{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          {filtered.map((piece) => (
            <div
              key={piece.id}
              className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-accent/30"
            >
              <button
                onClick={() => toggleSelect(piece.id)}
                aria-label={selected.has(piece.id) ? `Deselect ${piece.title}` : `Select ${piece.title}`}
                aria-pressed={selected.has(piece.id)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                {selected.has(piece.id) ? (
                  <CheckSquare className="size-4 text-primary" />
                ) : (
                  <Square className="size-4" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/studio/drafts/${piece.id}`}
                  className="group flex items-center gap-2"
                >
                  <span className="truncate font-display text-base text-foreground transition-colors group-hover:text-primary">
                    {piece.title || "Untitled"}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    {PIECE_STATUS_ICON[piece.status]}
                    <span className="capitalize">{piece.status}</span>
                  </span>
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Updated {fmt(piece.updated_at)}
                  {piece.published_at &&
                    ` · Published ${fmt(piece.published_at)}`}
                  {piece.slug && (
                    <span className="ml-2 font-mono">
                      /{piece.slug}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Link href={`/studio/drafts/${piece.id}`}>
                  <Button variant="ghost" size="icon" title="Open in composer">
                    <Pencil className="size-4" />
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" title="More options">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/studio/drafts/${piece.id}`}>
                        <Pencil className="mr-2 size-4" /> Edit
                      </Link>
                    </DropdownMenuItem>

                    {piece.status === "draft" && (
                      <DropdownMenuItem onClick={() => updateSinglePiece(piece.id, "published")}>
                        <Globe className="mr-2 size-4" /> Publish
                      </DropdownMenuItem>
                    )}

                    {piece.status === "published" && (
                      <DropdownMenuItem onClick={() => updateSinglePiece(piece.id, "draft")}>
                        <FileText className="mr-2 size-4" /> Unpublish
                      </DropdownMenuItem>
                    )}

                    {piece.status !== "archived" && piece.status !== "deleted" && (
                      <DropdownMenuItem onClick={() => updateSinglePiece(piece.id, "archived")}>
                        <Archive className="mr-2 size-4" /> Archive
                      </DropdownMenuItem>
                    )}

                    {piece.status === "archived" && (
                      <DropdownMenuItem onClick={() => updateSinglePiece(piece.id, "draft")}>
                        <RotateCcw className="mr-2 size-4" /> Unarchive
                      </DropdownMenuItem>
                    )}

                    {piece.status === "deleted" && (
                      <DropdownMenuItem onClick={() => updateSinglePiece(piece.id, "draft")}>
                        <RotateCcw className="mr-2 size-4" /> Restore
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />

                    {piece.status === "deleted" ? (
                      <DropdownMenuItem
                        onClick={() => deleteSinglePiece(piece.id)}
                        className="text-destructive focus:bg-destructive focus:text-destructive dark:focus:bg-destructive"
                      >
                        <Trash2 className="mr-2 size-4" /> Delete permanently
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => updateSinglePiece(piece.id, "deleted")}
                        className="text-destructive focus:bg-destructive focus:text-destructive dark:focus:bg-destructive"
                      >
                        <Trash2 className="mr-2 size-4" /> Move to bin
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

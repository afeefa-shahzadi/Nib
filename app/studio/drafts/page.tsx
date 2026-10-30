"use client"

import { StudioSkeleton } from "@/components/studio/studio-skeleton"
import { useEffect, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { DraftPiece } from "@/lib/types/content"
import {
  pageMyPieces,
  createPiece,
  importMarkdown,
  bulkUpdatePieces,
  bulkDeletePieces,
} from "@/actions/content"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  Plus,
  Upload,
  FileText,
  Trash2,
  Pencil,
  Globe,
  Archive,
  X,
  RotateCcw,
  MoreHorizontal,
  ChevronDown,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

const TABS = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "scheduled", label: "Scheduled" },
  { id: "published", label: "Published" },
  { id: "archived", label: "Archived" },
  { id: "deleted", label: "Bin" },
] as const
type TabId = (typeof TABS)[number]["id"]

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
  deleted: "In bin",
}

const EMPTY: Record<TabId, string> = {
  all: "No pieces yet. Start one, or bring your writing over with Import.",
  draft: "No drafts. Pieces you haven't published show up here.",
  scheduled:
    "Nothing scheduled. Set a release date in the composer to schedule a piece.",
  published: "Nothing published yet.",
  archived: "No archived pieces. Archive hides a piece without deleting it.",
  deleted:
    "The bin is empty. Pieces you delete wait here until you restore or remove them.",
}

const PAGE = 20

const SORTS = {
  edited: "Last edited",
  published: "Newest published",
  title: "Title A–Z",
} as const
type SortId = keyof typeof SORTS

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

export default function DraftsPage() {
  const router = useRouter()

  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [creating, setCreating] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importTitle, setImportTitle] = useState("")
  const [importMd, setImportMd] = useState("")
  const [importing, setImporting] = useState(false)
  const [showMigrate, setShowMigrate] = useState(false)
  const [migrateUrl, setMigrateUrl] = useState("")
  const [migrating, setMigrating] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<TabId>("all")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortId>("edited")
  const [visibility, setVisibility] = useState("any")
  const [page, setPage] = useState(0)
  const [toDelete, setToDelete] = useState<DraftPiece | null>(null)

  // Wait for a pause in typing before searching.
  const [query, setQuery] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const q = useQuery({
    queryKey: ["my-pieces-page", tab, visibility, sort, query, page],
    queryFn: () =>
      pageMyPieces({ tab, visibility, sort, search: query, page, perPage: PAGE }),
    placeholderData: keepPreviousData,
  })
  const shown = (q.data?.rows ?? []) as DraftPiece[]
  const total = q.data?.total ?? 0

  const create = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCreating(true)
    try {
      const piece = await createPiece({
        data: { title: newTitle.trim() || "Untitled piece" },
      })
      router.push(`/studio/drafts/${piece.id}`)
    } catch (err) {
      toast.error((err as Error).message)
      setCreating(false)
    }
  }

  const importDraft = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!importTitle.trim() || !importMd.trim()) return
    setImporting(true)
    try {
      const piece = await importMarkdown({
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
    const name = file.name.replace(/\.md$/i, "")
    if (!importTitle) setImportTitle(name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (typeof ev.target?.result === "string") setImportMd(ev.target.result)
    }
    reader.readAsText(file)
  }

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const bulkStatus = async (status: string, done: string) => {
    try {
      await bulkUpdatePieces({
        data: { ids: [...selected], patch: { status } },
      })
      toast.success(done)
      setSelected(new Set())
      q.refetch()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const bulkDelete = async () => {
    try {
      await bulkDeletePieces({ data: { ids: [...selected] } })
      toast.success("Permanently deleted")
      setSelected(new Set())
      q.refetch()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const updateSinglePiece = async (id: string, status: string) => {
    try {
      await bulkUpdatePieces({ data: { ids: [id], patch: { status } } })
      toast.success(
        status === "deleted"
          ? "Moved to bin"
          : `Moved to ${STATUS_LABEL[status].toLowerCase()}`
      )
      q.refetch()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const deleteSinglePiece = async (id: string) => {
    try {
      await bulkDeletePieces({ data: { ids: [id] } })
      toast.success("Permanently deleted")
      q.refetch()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const countOf = (t: TabId) => q.data?.counts[t] ?? 0
  const term = search.trim()
  const pages = Math.max(1, Math.ceil(total / PAGE))
  const current = page
  const allSelected = shown.length > 0 && shown.every((p) => selected.has(p.id))
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(shown.map((p) => p.id)))
  const filtering = !!term || visibility !== "any"

  const meta = (p: DraftPiece) => {
    if (p.status === "scheduled" && p.scheduled_for)
      return `Goes live ${fmt(p.scheduled_for)}`
    if (p.status === "published" && p.published_at)
      return `Published ${fmt(p.published_at)}`
    return `Edited ${fmt(p.updated_at)}`
  }

  return (
    <div className="mx-auto w-full max-w-350 px-4 py-6 pb-28 sm:px-6 md:px-8 md:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-foreground">Pieces</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {countOf("all")} total · {countOf("published")} published
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="min-h-11">
                <Upload className="size-4" aria-hidden /> Import
                <ChevronDown
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="min-h-11"
                onSelect={() => setShowImport(true)}
              >
                <FileText className="size-4" aria-hidden /> Markdown file or
                text
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-11"
                onSelect={() => setShowMigrate(true)}
              >
                <Globe className="size-4" aria-hidden /> Substack, Medium or a
                link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button className="min-h-11" onClick={() => setShowCreate(true)}>
            <Plus className="size-4" aria-hidden /> New piece
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as TabId)
            setSelected(new Set())
            setPage(0)
          }}
          className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
          <TabsList className="h-auto">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="min-h-10 gap-1.5 px-3"
              >
                {t.label}
                <span className="text-muted-foreground tabular-nums">
                  {countOf(t.id)}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2 md:flex-nowrap">
          <Select
            value={visibility}
            onValueChange={(v) => {
              setVisibility(v)
              setPage(0)
            }}
          >
            <SelectTrigger
              className="min-h-11 w-[calc(50%-0.25rem)] md:w-40"
              aria-label="Visibility"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Anyone</SelectItem>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="members_only">Members only</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sort}
            onValueChange={(v) => {
              setSort(v as SortId)
              setPage(0)
            }}
          >
            <SelectTrigger
              className="min-h-11 w-[calc(50%-0.25rem)] md:w-44"
              aria-label="Sort"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORTS) as SortId[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {SORTS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-full md:w-72 2xl:w-64">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
              }}
              placeholder="Search by title"
              aria-label="Search pieces"
              className="min-h-11 pl-9"
            />
          </div>
        </div>
      </div>

      {/* Pieces list */}
      {q.isLoading ? (
        <StudioSkeleton header={false} />
      ) : shown.length === 0 ? (
        <div className="surface rounded-lg px-4 py-16 text-center">
          <FileText
            className="mx-auto mb-3 size-8 text-muted-foreground/40"
            aria-hidden
          />
          <p className="mx-auto max-w-sm text-muted-foreground">
            {filtering ? "No pieces match these filters." : EMPTY[tab]}
          </p>
          {!filtering && tab === "all" && (
            <Button
              className="mt-4 min-h-11"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="size-4" aria-hidden /> New piece
            </Button>
          )}
        </div>
      ) : (
        <div className="surface divide-y divide-border rounded-lg">
          <div className="flex min-h-11 items-center gap-3 px-4 text-sm text-muted-foreground">
            <Checkbox
              className="relative after:absolute after:-inset-3.5 after:content-['']"
              checked={allSelected}
              onCheckedChange={toggleAll}
              aria-label="Select all"
            />
            Select all on this page
          </div>

          {shown.map((piece) => (
            <div
              key={piece.id}
              className="flex min-h-16 items-center gap-1 pr-2 transition-colors hover:bg-accent/30"
            >
              <div className="flex size-11 shrink-0 items-center justify-center pl-1">
                <Checkbox
                  className="relative after:absolute after:-inset-3.5 after:content-['']"
                  checked={selected.has(piece.id)}
                  onCheckedChange={() => toggleSelect(piece.id)}
                  aria-label={`Select ${piece.title || "untitled piece"}`}
                />
              </div>

              <Link
                href={`/studio/drafts/${piece.id}`}
                className="group min-w-0 flex-1 py-3"
              >
                <span className="flex items-center gap-2">
                  <span className="truncate font-display text-base text-foreground group-hover:text-primary">
                    {piece.title || "Untitled piece"}
                  </span>
                  <Badge
                    variant={
                      piece.status === "published" ? "secondary" : "outline"
                    }
                    className="shrink-0 font-normal"
                  >
                    {STATUS_LABEL[piece.status] ?? piece.status}
                  </Badge>
                </span>
                <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                  {meta(piece)}
                  {piece.slug && (
                    <span className="hidden font-mono sm:inline">
                      {" "}
                      · /{piece.slug}
                    </span>
                  )}
                </span>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0"
                    aria-label={`Actions for ${piece.title || "untitled piece"}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/studio/drafts/${piece.id}`}>
                      <Pencil className="size-4" /> Edit
                    </Link>
                  </DropdownMenuItem>
                  {(piece.status === "draft" ||
                    piece.status === "scheduled") && (
                    <DropdownMenuItem
                      onClick={() => updateSinglePiece(piece.id, "published")}
                    >
                      <Globe className="size-4" /> Publish now
                    </DropdownMenuItem>
                  )}
                  {piece.status === "published" && (
                    <DropdownMenuItem
                      onClick={() => updateSinglePiece(piece.id, "draft")}
                    >
                      <FileText className="size-4" /> Unpublish
                    </DropdownMenuItem>
                  )}
                  {piece.status !== "archived" &&
                    piece.status !== "deleted" && (
                      <DropdownMenuItem
                        onClick={() => updateSinglePiece(piece.id, "archived")}
                      >
                        <Archive className="size-4" /> Archive
                      </DropdownMenuItem>
                    )}
                  {piece.status === "archived" && (
                    <DropdownMenuItem
                      onClick={() => updateSinglePiece(piece.id, "draft")}
                    >
                      <RotateCcw className="size-4" /> Unarchive
                    </DropdownMenuItem>
                  )}
                  {piece.status === "deleted" && (
                    <DropdownMenuItem
                      onClick={() => updateSinglePiece(piece.id, "draft")}
                    >
                      <RotateCcw className="size-4" /> Restore
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {piece.status === "deleted" ? (
                    <DropdownMenuItem
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                      onSelect={() => setToDelete(piece)}
                    >
                      <Trash2 className="size-4" /> Delete permanently
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                      onClick={() => updateSinglePiece(piece.id, "deleted")}
                    >
                      <Trash2 className="size-4" /> Move to bin
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          <nav
            aria-label="Pages"
            className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm text-muted-foreground"
          >
            <span>
              {current * PAGE + 1}–{current * PAGE + shown.length} of{" "}
              {total}
            </span>
            {pages > 1 && (
              <span className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label="Previous page"
                  disabled={current === 0}
                  onClick={() => setPage(current - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="tabular-nums">
                  Page {current + 1} of {pages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label="Next page"
                  disabled={current >= pages - 1}
                  onClick={() => setPage(current + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </span>
            )}
          </nav>
        </div>
      )}

      {/* Bulk actions: pinned to the bottom while anything is selected */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 lg:left-64">
          <div className="surface-elevated flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-border p-2 shadow-lg">
            <span className="px-2 text-sm text-muted-foreground">
              {selected.size} selected
            </span>
            {tab === "deleted" ? (
              <>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => bulkStatus("draft", "Restored to drafts")}
                >
                  <RotateCcw className="size-4" aria-hidden /> Restore
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button variant="destructive" className="min-h-11">
                      <Trash2 className="size-4" aria-hidden /> Delete forever
                    </Button>
                  }
                  title={`Permanently delete ${selected.size} ${selected.size === 1 ? "piece" : "pieces"}?`}
                  description="This can't be undone."
                  destructive
                  confirmLabel="Delete forever"
                  onConfirm={bulkDelete}
                />
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => bulkStatus("published", "Published")}
                >
                  <Globe className="size-4" aria-hidden /> Publish
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => bulkStatus("archived", "Archived")}
                >
                  <Archive className="size-4" aria-hidden /> Archive
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" className="min-h-11">
                      <Trash2 className="size-4" aria-hidden /> Delete
                    </Button>
                  }
                  title={`Move ${selected.size} ${selected.size === 1 ? "piece" : "pieces"} to the bin?`}
                  description="You can restore them later from the Bin tab."
                  destructive
                  confirmLabel="Move to bin"
                  onConfirm={() => bulkStatus("deleted", "Moved to bin")}
                />
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label="Clear selection"
              onClick={() => setSelected(new Set())}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* New piece */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={create} className="space-y-4">
            <DialogHeader>
              <DialogTitle>New piece</DialogTitle>
              <DialogDescription>
                Give it a title now or leave it blank and name it later.
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label htmlFor="new-title">Title</Label>
              <Input
                id="new-title"
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Untitled piece"
                className="mt-1 min-h-11"
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="min-h-11" disabled={creating}>
                {creating ? "Creating…" : "Start writing"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import markdown */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={importDraft} className="min-w-0 space-y-4">
            <DialogHeader>
              <DialogTitle>Import markdown</DialogTitle>
              <DialogDescription>
                Upload a .md file or paste the text. It becomes a draft.
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label htmlFor="md-file">Markdown file</Label>
              <Input
                id="md-file"
                type="file"
                accept=".md,text/markdown"
                onChange={handleFileUpload}
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or paste it
              <span className="h-px flex-1 bg-border" />
            </div>
            <div>
              <Label htmlFor="md-title">Title</Label>
              <Input
                id="md-title"
                required
                value={importTitle}
                onChange={(e) => setImportTitle(e.target.value)}
                className="mt-1 min-h-11"
              />
            </div>
            <div>
              <Label htmlFor="md-body">Markdown</Label>
              <Textarea
                id="md-body"
                required
                rows={8}
                value={importMd}
                onChange={(e) => setImportMd(e.target.value)}
                placeholder="Paste your markdown here…"
                className="mt-1 max-h-[40vh] font-mono text-sm"
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="min-h-11" disabled={importing}>
                {importing ? "Importing…" : "Import"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import from Substack / Medium / URL */}
      <Dialog
        open={showMigrate}
        onOpenChange={(o) => !migrating && setShowMigrate(o)}
      >
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={migrateFromUrl} className="min-w-0 space-y-4">
            <DialogHeader>
              <DialogTitle>Bring your writing over</DialogTitle>
              <DialogDescription>
                Every post becomes a draft you can edit before publishing.
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label htmlFor="zip-file">Substack or Medium export (.zip)</Label>
              <Input
                id="zip-file"
                type="file"
                accept=".zip,application/zip"
                onChange={migrateFile}
                disabled={migrating}
                className="mt-1"
              />
              <p className="mt-1.5 text-sm text-muted-foreground">
                Substack: Settings → Exports. Medium: Settings → Download your
                information.
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or one article by link
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="flex min-w-0 gap-2">
              <Input
                type="text"
                inputMode="url"
                aria-label="Article link"
                value={migrateUrl}
                onChange={(e) => setMigrateUrl(e.target.value)}
                placeholder="https://author.substack.com/p/my-post"
                className="min-h-11 min-w-0 flex-1"
                disabled={migrating}
              />
              <Button
                type="submit"
                className="min-h-11"
                disabled={migrating || !migrateUrl.trim()}
              >
                {migrating ? "Importing…" : "Import"}
              </Button>
            </div>
            {migrating && (
              <p className="text-sm text-muted-foreground">
                Importing. Large exports can take a moment…
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* Permanent delete of one piece */}
      <AlertDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{toDelete?.title || "Untitled piece"}&rdquo;
              forever?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && deleteSinglePiece(toDelete.id)}
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

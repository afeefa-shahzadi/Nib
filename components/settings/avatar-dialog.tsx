"use client"
import { useEffect, useRef, useState } from "react"
import { FlipHorizontal2, FlipVertical2, ImageUp, RotateCcw, RotateCw } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { toast } from "sonner"

const VIEW = 240 // preview size in CSS px (fits a 320px phone)
const OUT = 512 // saved image size
const MAX_BYTES = 5 * 1024 * 1024

type Edit = { zoom: number; x: number; y: number; rot: number; flipH: boolean; flipV: boolean }
const START: Edit = { zoom: 1, x: 0, y: 0, rot: 0, flipH: false, flipV: false }

// Largest pan (in preview px) that still keeps the circle filled.
function maxPan(img: HTMLImageElement, e: Edit) {
  const s = (VIEW / Math.min(img.width, img.height)) * e.zoom
  const turned = e.rot % 180 !== 0
  const w = (turned ? img.height : img.width) * s
  const h = (turned ? img.width : img.height) * s
  return { x: Math.max(0, (w - VIEW) / 2), y: Math.max(0, (h - VIEW) / 2) }
}

function clampEdit(img: HTMLImageElement, e: Edit): Edit {
  const m = maxPan(img, e)
  return { ...e, x: Math.max(-m.x, Math.min(m.x, e.x)), y: Math.max(-m.y, Math.min(m.y, e.y)) }
}

function draw(ctx: CanvasRenderingContext2D, img: HTMLImageElement, e: Edit, size: number) {
  const k = size / VIEW
  const s = (size / Math.min(img.width, img.height)) * e.zoom
  ctx.clearRect(0, 0, size, size)
  ctx.save()
  ctx.translate(size / 2 + e.x * k, size / 2 + e.y * k)
  ctx.scale(e.flipH ? -1 : 1, e.flipV ? -1 : 1) // flips stay screen-horizontal/vertical after rotating
  ctx.rotate((e.rot * Math.PI) / 180)
  ctx.drawImage(img, (-img.width * s) / 2, (-img.height * s) / 2, img.width * s, img.height * s)
  ctx.restore()
}

export function AvatarDialog({
  open,
  onOpenChange,
  onSave,
  onUseUrl,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSave: (image: Blob) => Promise<void>
  onUseUrl: (url: string) => Promise<void>
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [edit, setEdit] = useState<Edit>(START)
  const [url, setUrl] = useState("")
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null)

  useEffect(() => {
    const c = canvas.current
    if (!c || !img) return
    const dpr = window.devicePixelRatio || 1
    c.width = c.height = VIEW * dpr
    const ctx = c.getContext("2d")!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    draw(ctx, img, edit, VIEW)
  }, [img, edit])

  const close = () => {
    setImg(null)
    setEdit(START)
    setUrl("")
    setBlockedUrl(null)
    onOpenChange(false)
  }

  const load = (src: string) =>
    new Promise<void>((resolve, reject) => {
      const i = new Image()
      i.onload = () => {
        setImg(i)
        setEdit(START)
        resolve()
      }
      i.onerror = () => reject(new Error("That file isn't an image we can open."))
      i.src = src
    })

  const fromFile = async (file?: File | null) => {
    if (!file) return
    if (!file.type.startsWith("image/")) return toast.error("Choose an image file.")
    if (file.size > MAX_BYTES) return toast.error("Images must be under 5 MB.")
    try {
      await load(URL.createObjectURL(file))
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const fromUrl = async () => {
    const u = url.trim()
    if (!/^https?:\/\//i.test(u)) return toast.error("Paste a link that starts with https://")
    setBusy(true)
    setBlockedUrl(null)
    try {
      // Fetch to a local copy so the canvas can edit it; many sites block this.
      const res = await fetch(u)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      if (!blob.type.startsWith("image/")) throw new Error()
      await fromFile(new File([blob], "image", { type: blob.type }))
    } catch {
      setBlockedUrl(u)
    } finally {
      setBusy(false)
    }
  }

  const change = (patch: Partial<Edit>) => img && setEdit((e) => clampEdit(img, { ...e, ...patch }))

  const save = async () => {
    if (!img) return
    setBusy(true)
    try {
      const c = document.createElement("canvas")
      c.width = c.height = OUT
      draw(c.getContext("2d")!, img, edit, OUT)
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.9))
      if (!blob) throw new Error("Couldn't prepare the image.")
      await onSave(blob)
      close()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{img ? "Edit photo" : "Profile photo"}</DialogTitle>
          <DialogDescription>
            {img ? "Drag to move. Zoom, rotate or flip, then save." : "Drop an image, choose a file, or paste a link."}
          </DialogDescription>
        </DialogHeader>

        {!img ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(true)
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setOver(false)
                void fromFile(e.dataTransfer.files?.[0])
              }}
              className={`flex w-full flex-col items-center gap-2 rounded-md border-2 border-dashed px-4 py-10 text-sm transition-colors ${
                over ? "border-primary bg-primary/5" : "border-border hover:border-foreground/40"
              }`}
            >
              <ImageUp className="size-6 text-muted-foreground" aria-hidden />
              <span className="font-medium text-foreground">Drop an image here</span>
              <span className="text-muted-foreground">or click to choose · JPG, PNG, WebP · up to 5 MB</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void fromFile(e.target.files?.[0])
                e.target.value = ""
              }}
            />
            <div>
              <Label htmlFor="avatar-url">Image link</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  id="avatar-url"
                  type="text"
                  inputMode="url"
                  placeholder="https://…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void fromUrl())}
                />
                <Button type="button" variant="outline" onClick={fromUrl} disabled={busy || !url.trim()}>
                  Add
                </Button>
              </div>
              {blockedUrl && (
                <p className="mt-2 text-sm text-muted-foreground">
                  That site doesn&apos;t allow editing its images.{" "}
                  <button
                    type="button"
                    className="font-medium text-foreground underline underline-offset-2"
                    onClick={async () => {
                      setBusy(true)
                      try {
                        await onUseUrl(blockedUrl)
                        close()
                      } catch (e) {
                        toast.error((e as Error).message)
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    Use it as is
                  </button>
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative mx-auto touch-none select-none" style={{ width: VIEW, height: VIEW, maxWidth: "100%" }}>
              <canvas
                ref={canvas}
                aria-label="Photo preview. Drag to move."
                className="size-full cursor-grab rounded-md bg-muted active:cursor-grabbing"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  drag.current = { px: e.clientX, py: e.clientY, x: edit.x, y: edit.y }
                }}
                onPointerMove={(e) => {
                  const d = drag.current
                  if (d) change({ x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py })
                }}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
              />
              {/* Dim outside the circle that will show on your profile. */}
              <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgb(0_0_0/0.45)] ring-2 ring-background/80" />
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="avatar-zoom" className="shrink-0">Zoom</Label>
              <Slider
                id="avatar-zoom"
                min={1}
                max={3}
                step={0.01}
                value={[edit.zoom]}
                onValueChange={([z]) => change({ zoom: z })}
              />
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Rotate left" title="Rotate left" onClick={() => change({ rot: (edit.rot + 270) % 360 })}>
                <RotateCcw className="size-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Rotate right" title="Rotate right" onClick={() => change({ rot: (edit.rot + 90) % 360 })}>
                <RotateCw className="size-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Flip horizontally" aria-pressed={edit.flipH} title="Flip horizontally" onClick={() => change({ flipH: !edit.flipH })}>
                <FlipHorizontal2 className="size-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Flip vertically" aria-pressed={edit.flipV} title="Flip vertically" onClick={() => change({ flipV: !edit.flipV })}>
                <FlipVertical2 className="size-4" />
              </Button>
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => setEdit(START)}>
                Reset
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {img && (
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => setImg(null)} disabled={busy}>
              Choose another
            </Button>
          )}
          <Button type="button" className="min-h-11" onClick={save} disabled={!img || busy}>
            {busy && img ? "Saving…" : "Save photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

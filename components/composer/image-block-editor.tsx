"use client"
import { useRef, useState } from "react"
import { ImagePlus, Loader2, X, Link2 } from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase/client"

interface Props {
  imageUrl?: string
  alt?: string
  caption?: string
  credit?: string
  creditUrl?: string
  onChange: (patch: {
    imageUrl?: string
    alt?: string
    caption?: string
    credit?: string
    creditUrl?: string
  }) => void
}

const MAX_BYTES = 8 * 1024 * 1024 // 8MB

export function ImageBlockEditor({
  imageUrl,
  alt,
  caption,
  credit,
  creditUrl,
  onChange,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [showUrl, setShowUrl] = useState(false)
  const [urlDraft, setUrlDraft] = useState("")

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files")
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error("Max 8 MB")
      return
    }
    setUploading(true)
    try {
      const { data: sess } = await supabase.auth.getUser()
      const uid = sess.user?.id
      if (!uid) throw new Error("Sign in required")
      const ext =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase()
          .replace(/[^a-z0-9]/g, "") || "jpg"
      const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error } = await supabase.storage
        .from("post-media")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        })
      if (error) throw error
      const { data: pub } = supabase.storage
        .from("post-media")
        .getPublicUrl(path)
      onChange({ imageUrl: pub.publicUrl })
      toast.success("Image uploaded")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      {imageUrl ? (
        <div className="group relative">
          {}
          <Image
            src={imageUrl}
            alt={alt ?? ""}
            width={800}
            height={420}
            className="max-h-[420px] w-full rounded border border-border bg-muted/30 object-contain"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange({ imageUrl: "" })
            }}
            className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded border border-border bg-background/90 opacity-0 transition group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
            title="Remove image"
            aria-label="Remove image"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div
          onDrop={(e) => {
            e.preventDefault()
            const f = e.dataTransfer.files?.[0]
            if (f) void upload(f)
          }}
          onDragOver={(e) => e.preventDefault()}
          className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-8 text-center"
        >
          {uploading ? (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Uploading…
            </span>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <ImagePlus className="size-6 text-muted-foreground" />
              <p className="text-sm">Drop an image here, or</p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileRef.current?.click()
                  }}
                >
                  Choose file
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowUrl((s) => !s)
                  }}
                >
                  <Link2 className="mr-1 size-3.5" /> From URL
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                PNG · JPG · GIF · WEBP · up to 8 MB
              </p>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void upload(f)
              e.currentTarget.value = ""
            }}
          />
          {showUrl && (
            <div className="mx-auto mt-3 flex max-w-md gap-2">
              <Input
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://…"
                className="h-8 text-sm"
              />
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  if (!urlDraft.trim()) return
                  onChange({ imageUrl: urlDraft.trim() })
                  setUrlDraft("")
                  setShowUrl(false)
                }}
              >
                Use
              </Button>
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          value={alt ?? ""}
          onChange={(e) => onChange({ alt: e.target.value })}
          placeholder="Alt text (for accessibility)"
          className="h-8 text-sm"
        />
        <Input
          value={caption ?? ""}
          onChange={(e) => onChange({ caption: e.target.value })}
          placeholder="Caption (shown below)"
          className="h-8 text-sm"
        />
        <Input
          value={credit ?? ""}
          onChange={(e) => onChange({ credit: e.target.value })}
          placeholder="Credit (e.g. Photo by Jane Doe)"
          className="h-8 text-sm"
        />
        <Input
          value={creditUrl ?? ""}
          onChange={(e) => onChange({ creditUrl: e.target.value })}
          placeholder="Credit link (optional)"
          className="h-8 text-sm"
        />
      </div>
    </div>
  )
}

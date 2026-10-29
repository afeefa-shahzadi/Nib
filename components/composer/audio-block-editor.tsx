"use client"
import { useRef, useState } from "react"
import { Mic, Loader2, X, Link2 } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase/client"

interface Props {
  audioUrl?: string
  transcript?: string
  caption?: string
  onChange: (patch: {
    audioUrl?: string
    transcript?: string
    caption?: string
  }) => void
}

const MAX_AUDIO = 25 * 1024 * 1024 // 25 MB
const MAX_VIDEO = 200 * 1024 * 1024 // 200 MB

const isVideoUrl = (u: string) => /\.(mp4|webm|mov|m4v|qt|ogv)(\?|$)/i.test(u)

export function AudioBlockEditor({
  audioUrl,
  transcript,
  caption,
  onChange,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [showUrl, setShowUrl] = useState(false)
  const [urlDraft, setUrlDraft] = useState("")

  const upload = async (file: File) => {
    const isVid = file.type.startsWith("video/")
    if (!file.type.startsWith("audio/") && !isVid) {
      toast.error("Only audio or video files")
      return
    }
    if (file.size > (isVid ? MAX_VIDEO : MAX_AUDIO)) {
      toast.error(`Max ${isVid ? 200 : 25} MB`)
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
          .replace(/[^a-z0-9]/g, "") || (isVid ? "mp4" : "mp3")
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
      onChange({ audioUrl: pub.publicUrl })
      toast.success(isVid ? "Video uploaded" : "Audio uploaded")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      {audioUrl ? (
        <div className="group relative rounded border border-border bg-muted/30 p-4">
          {isVideoUrl(audioUrl) ? (
            <video src={audioUrl} controls className="max-h-80 w-full rounded" />
          ) : (
            <audio src={audioUrl} controls className="h-10 w-full" />
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange({ audioUrl: "" })
            }}
            className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded border border-border bg-background/90 opacity-0 transition group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
            title="Remove audio"
            aria-label="Remove audio"
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
              <Mic className="size-6 text-muted-foreground" />
              <p className="text-sm">Drop an audio or video file here, or</p>
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
                Audio (MP3 · WAV · M4A, 25 MB) or video (MP4 · WebM · MOV, 200 MB)
              </p>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,video/*"
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
                  onChange({ audioUrl: urlDraft.trim() })
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

      <div className="mt-2 space-y-2">
        <Textarea
          value={transcript ?? ""}
          onChange={(e) => onChange({ transcript: e.target.value })}
          rows={3}
          placeholder="Transcript / scene note"
          className="text-sm"
        />
        <Input
          value={caption ?? ""}
          onChange={(e) => onChange({ caption: e.target.value })}
          placeholder="Caption (optional)"
          className="text-xs"
        />
      </div>
    </div>
  )
}

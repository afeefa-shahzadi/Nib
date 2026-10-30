"use client"

import { Block, getStr } from "../block-renderer"

export function EmbedBlock({ block }: { block: Block }) {
  const rawUrl = getStr(block.content, "embedUrl")
  const cap = getStr(block.content, "embedTitle")

  if (!rawUrl) return null

  let url = rawUrl
  try {
    const urlObj = new URL(rawUrl)
    if (
      urlObj.hostname.includes("youtube.com") &&
      urlObj.pathname === "/watch"
    ) {
      const v = urlObj.searchParams.get("v")
      if (v) url = `https://www.youtube-nocookie.com/embed/${v}`
    } else if (urlObj.hostname === "youtu.be") {
      const v = urlObj.pathname.slice(1)
      if (v) url = `https://www.youtube-nocookie.com/embed/${v}`
    } else if (
      urlObj.hostname.includes("loom.com") &&
      urlObj.pathname.startsWith("/share/")
    ) {
      const id = urlObj.pathname.replace("/share/", "")
      url = `https://www.loom.com/embed/${id}`
    } else if (
      urlObj.hostname.includes("vimeo.com") &&
      !urlObj.hostname.includes("player.vimeo.com")
    ) {
      const id = urlObj.pathname.split("/").pop()
      if (id && !isNaN(Number(id))) url = `https://player.vimeo.com/video/${id}?dnt=1`
    }
  } catch {
    // ignore invalid URL
  }

  return (
    <figure className="my-8">
      <div
        className="relative w-full overflow-hidden rounded-md border border-border bg-muted/30"
        style={{ paddingBottom: "56.25%" }}
      >
        <iframe
          src={url}
          className="absolute top-0 left-0 h-full w-full border-0"
          allowFullScreen
          loading="lazy"
          title={cap || "Embedded content"}
        />
      </div>
      {cap && (
        <figcaption className="mt-2 text-center text-xs text-muted-foreground italic">
          {cap}
        </figcaption>
      )}
    </figure>
  )
}

const isVideoUrl = (u: string) => /\.(mp4|webm|mov|m4v|qt|ogv)(\?|$)/i.test(u)

export function AudioNoteBlock({ block }: { block: Block }) {
  const audio = getStr(block.content, "audioUrl")
  const transcript = getStr(block.content, "transcript") ?? ""
  const cap = getStr(block.content, "caption")
  const video = audio ? isVideoUrl(audio) : false

  return (
    <figure className="surface my-6 rounded-md border border-info/30 px-5 py-4">
      <p className="mb-2 text-xs text-info">
        {video ? "Video" : "Audio note"}
      </p>
      {audio ? (
        video ? (
          <video src={audio} controls preload="none" className="max-h-96 w-full rounded" />
        ) : (
          <audio src={audio} controls preload="none" className="w-full" />
        )
      ) : (
        <p className="text-xs text-muted-foreground italic">
          No media attached
        </p>
      )}
      {transcript && (
        <details className="mt-3 text-sm text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            Transcript
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-foreground/85">
            {transcript}
          </p>
        </details>
      )}
      {cap && (
        <figcaption className="mt-2 text-xs text-muted-foreground italic">
          {cap}
        </figcaption>
      )}
    </figure>
  )
}

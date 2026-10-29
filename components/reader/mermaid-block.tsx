"use client"

import { useState } from "react"
import { ZoomIn, Maximize2 } from "lucide-react"
import { Block, getStr } from "../block-renderer"
import dynamic from "next/dynamic"
import { MediaLightbox } from "./media-lightbox"

// mermaid is ~1MB parsed; only fetch it when a piece has a diagram. It renders client-side anyway.
const MermaidRenderer = dynamic(() => import("./mermaid-renderer").then((m) => m.MermaidRenderer), {
  ssr: false,
  loading: () => <div className="my-8 h-48 animate-pulse rounded-md bg-muted/30" aria-hidden />,
})

export function MermaidBlock({ block }: { block: Block }) {
  const code = getStr(block.content, "mermaidCode")
  const caption = getStr(block.content, "caption")
  const [open, setOpen] = useState(false)

  if (!code) return null

  const diagram = <MermaidRenderer code={code} />

  return (
    <>
      <figure className="my-8 flex flex-col items-center">
        <div className="group relative w-full rounded-lg border bg-muted/20 p-4">
          {/* Click anywhere on diagram to open lightbox */}
          <div
            className="cursor-zoom-in"
            onClick={() => setOpen(true)}
            title="Click to expand"
          >
            <div className="pointer-events-none">{diagram}</div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
              <span className="rounded-full bg-black/40 p-2 backdrop-blur-sm">
                <ZoomIn className="size-5 text-white" />
              </span>
            </div>
          </div>

          {/* Fullscreen button in corner */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setOpen(true)
            }}
            className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md bg-muted/60 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            title="Fullscreen"
            aria-label="Fullscreen"
          >
            <Maximize2 className="size-4" />
          </button>
        </div>

        {caption && (
          <figcaption className="mt-3 text-center text-xs text-muted-foreground italic">
            {caption}
          </figcaption>
        )}
      </figure>

      <MediaLightbox open={open} onClose={() => setOpen(false)}>
        <div className="max-w-[88vw] min-w-[60vw] rounded-lg bg-background p-8">
          {diagram}
        </div>
      </MediaLightbox>
    </>
  )
}

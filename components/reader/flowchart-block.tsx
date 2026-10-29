"use client"

import { useState, useCallback } from "react"
import { Maximize2 } from "lucide-react"
import dynamic from "next/dynamic"
import { Block, getStr } from "../block-renderer"
import { MediaLightbox } from "./media-lightbox"

const FlowchartViewer = dynamic(
  () => import("./flowchart-viewer").then((mod) => mod.FlowchartViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-100 animate-pulse items-center justify-center rounded-md border border-border bg-muted/20 text-xs text-muted-foreground">
        Loading interactive flowchart...
      </div>
    ),
  }
)

export function FlowchartBlock({ block }: { block: Block }) {
  const nodes = Array.isArray(block.content.nodes) ? block.content.nodes : []
  const edges = Array.isArray(block.content.edges) ? block.content.edges : []
  const cap = getStr(block.content, "caption")
  const [open, setOpen] = useState(false)
  const openLightbox = useCallback(() => setOpen(true), [])
  const closeLightbox = useCallback(() => setOpen(false), [])

  if (nodes.length === 0) return null

  return (
    <figure className="my-8 flex flex-col items-center">
      <div className="group relative w-full">
        <FlowchartViewer nodes={nodes} edges={edges} />
        <button
          onClick={openLightbox}
          className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-md border border-border bg-background/80 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          title="Fullscreen"
          aria-label="Fullscreen"
        >
          <Maximize2 className="size-4" />
        </button>
      </div>
      {cap && (
        <figcaption className="mt-3 text-center text-xs text-muted-foreground italic">
          {cap}
        </figcaption>
      )}

      <MediaLightbox open={open} onClose={closeLightbox}>
        <div className="h-[85vh] w-[88vw] overflow-hidden rounded-lg bg-background">
          <FlowchartViewer nodes={nodes} edges={edges} className="h-full" />
        </div>
      </MediaLightbox>
    </figure>
  )
}

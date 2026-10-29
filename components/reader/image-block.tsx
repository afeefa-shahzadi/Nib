"use client"

import { useState } from "react"
import { ZoomIn } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Block, getStr } from "../block-renderer"
import { MediaLightbox } from "./media-lightbox"

export function ImageBlock({ block }: { block: Block }) {
  const src = getStr(block.content, "imageUrl")
  const altText = getStr(block.content, "alt") ?? ""
  const cap = getStr(block.content, "caption")
  const credit = getStr(block.content, "credit")
  const creditUrl = getStr(block.content, "creditUrl")
  const [open, setOpen] = useState(false)

  if (!src) return null

  return (
    <>
      <figure className="my-8">
        <div
          className="group relative cursor-zoom-in"
          onClick={() => setOpen(true)}
          title="Click to expand"
        >
          <Image
            src={src}
            alt={altText}
            width={800}
            height={640}
            className="max-h-160 w-full rounded-md border border-border bg-muted/30 object-contain transition-opacity group-hover:opacity-90"
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <span className="rounded-full bg-black/40 p-2 backdrop-blur-sm">
              <ZoomIn className="size-5 text-white" />
            </span>
          </div>
        </div>
        {(cap || credit) && (
          <figcaption className="mt-2 text-center text-xs text-muted-foreground">
            {cap && <span className="italic">{cap}</span>}
            {cap && credit && (
              <span className="mx-1.5 text-muted-foreground/50">·</span>
            )}
            {credit &&
              (creditUrl ? (
                <Link
                  href={creditUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="not-italic underline-offset-2 hover:text-foreground hover:underline"
                >
                  {credit}
                </Link>
              ) : (
                <span className="not-italic">{credit}</span>
              ))}
          </figcaption>
        )}
      </figure>
      <MediaLightbox open={open} onClose={() => setOpen(false)}>
        <Image
          src={src}
          alt={altText}
          width={1600}
          height={1200}
          className="max-h-[85vh] max-w-[85vw] rounded-md object-contain"
          onClick={() => setOpen(false)}
        />
      </MediaLightbox>
    </>
  )
}

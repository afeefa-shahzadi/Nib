"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Megaphone, ExternalLink, ChevronRight } from "lucide-react"
import Link from "next/link"
import { getActiveSponsorships } from "@/actions/monetization"

type SponsorData = {
  sponsor_name: string
  sponsor_url: string | null
  sponsor_logo_url: string | null
  disclosure_text: string
}

export function SponsoredBanner({
  contentObjectId,
}: {
  contentObjectId: string
}) {
  const [sponsors, setSponsors] = useState<SponsorData[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    getActiveSponsorships({ data: { contentObjectId } })
      .then((r: SponsorData[]) => setSponsors(r || []))
      .catch(() => {})
  }, [contentObjectId])

  // Cycle sponsors every 4s if not hovered
  useEffect(() => {
    if (sponsors.length <= 1 || isHovered) return
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % sponsors.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [sponsors.length, isHovered])

  if (!sponsors || sponsors.length === 0) return null

  // If there's only 1 sponsor, don't do the complex hover UI
  if (sponsors.length === 1) {
    const s = sponsors[0]
    const inner = (
      <div className="group relative overflow-hidden rounded-xl border bg-muted/30 p-4 transition-colors hover:bg-muted/50 sm:p-5">
        <div className="absolute inset-0 bg-linear-to-r from-primary/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="relative flex items-center gap-4 sm:gap-5">
          {s.sponsor_logo_url ? (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background shadow-sm sm:size-12">
              <Image
                src={s.sponsor_logo_url}
                alt={s.sponsor_name}
                width={24}
                height={24}
                className="object-contain"
              />
            </div>
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm sm:size-12">
              <Megaphone className="size-5 sm:size-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="inline-flex items-center rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-primary uppercase">
                {s.disclosure_text}
              </span>
            </div>
            <p className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {s.sponsor_name}
            </p>
          </div>
          <div className="shrink-0 pr-1 pl-4 text-muted-foreground transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground">
            <ExternalLink className="size-5" />
          </div>
        </div>
      </div>
    )
    return s.sponsor_url ? (
      <Link
        href={s.sponsor_url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="mb-8 block no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {inner}
      </Link>
    ) : (
      <div className="mb-8">{inner}</div>
    )
  }

  // Multiple sponsors: Cycle UI + Hover Expansion
  const activeSponsor = sponsors[activeIndex]

  return (
    <div
      className="group relative mb-8 overflow-hidden rounded-xl border bg-muted/30 transition-all duration-300 hover:bg-muted/50 hover:shadow-sm"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-primary/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="relative flex flex-col p-4 sm:p-5">
        {/* Header/Active Sponsor */}
        <div className="flex items-center gap-4 sm:gap-5">
          {activeSponsor.sponsor_logo_url ? (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background shadow-sm sm:size-12">
              <Image
                src={activeSponsor.sponsor_logo_url}
                alt={activeSponsor.sponsor_name}
                width={24}
                height={24}
                className="object-contain"
              />
            </div>
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm sm:size-12">
              <Megaphone className="size-5 sm:size-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="inline-flex items-center rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-primary uppercase transition-colors">
                {isHovered ? "Sponsored by" : activeSponsor.disclosure_text}
              </span>
              {!isHovered && (
                <span className="flex animate-in gap-1 duration-300 fade-in zoom-in">
                  {sponsors.map((_, i) => (
                    <span
                      key={i}
                      className={`size-1.5 rounded-full transition-colors ${
                        i === activeIndex ? "bg-primary" : "bg-primary/20"
                      }`}
                    />
                  ))}
                </span>
              )}
            </div>
            <p className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {isHovered
                ? `${sponsors.length} Supporters`
                : activeSponsor.sponsor_name}
            </p>
          </div>

          <div className="shrink-0 pr-1 pl-4 text-muted-foreground transition-all duration-300 group-hover:text-foreground">
            {isHovered ? (
              <span className="text-[10px] font-medium tracking-wider uppercase">
                Explore
              </span>
            ) : (
              <ExternalLink className="size-5" />
            )}
          </div>
        </div>

        {/* Expanded Content (Hover State) */}
        <div
          className={`grid transition-all duration-300 ease-in-out ${
            isHovered
              ? "mt-4 grid-rows-[1fr] opacity-100"
              : "mt-0 grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="flex flex-col gap-2 overflow-hidden">
            {sponsors.map((s, idx) => (
              <Link
                key={idx}
                href={s.sponsor_url || "#"}
                target={s.sponsor_url ? "_blank" : undefined}
                rel={
                  s.sponsor_url ? "noopener noreferrer sponsored" : undefined
                }
                className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2.5 transition-colors hover:bg-background"
                onClick={(e) => {
                  if (!s.sponsor_url) e.preventDefault()
                }}
              >
                <div className="flex items-center gap-3">
                  {s.sponsor_logo_url ? (
                    <Image
                      src={s.sponsor_logo_url}
                      alt={s.sponsor_name}
                      width={16}
                      height={16}
                      className="object-contain"
                    />
                  ) : (
                    <Megaphone className="size-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">{s.sponsor_name}</span>
                </div>
                {s.sponsor_url && (
                  <ChevronRight className="size-4 text-muted-foreground" />
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

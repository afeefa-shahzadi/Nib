"use client"

import { useState } from "react"
import { calculateGraphCentrality, suggestAutoLinks } from "@/actions/ai"
import { Button } from "@/components/ui/button"
import { Network, Link as LinkIcon, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { BlockDraft } from "./types"

interface SynthesisPaneProps {
  pieceId: string
  blocks: BlockDraft[]
  scrollToBlock: (uid: string) => void
}

export function SynthesisPane({ pieceId, blocks, scrollToBlock }: SynthesisPaneProps) {
  const [centralityData, setCentralityData] = useState<{blockId: string, centralityScore: number, keyTheme: string}[]>([])
  const [linksData, setLinksData] = useState<{sourceText: string, targetPieceId: string, targetSlug: string, targetHandle: string | null, confidence: number}[]>([])
  const [isCentralityLoading, setIsCentralityLoading] = useState(false)
  const [isLinksLoading, setIsLinksLoading] = useState(false)
  const [hasSearchedCentrality, setHasSearchedCentrality] = useState(false)
  const [hasSearchedLinks, setHasSearchedLinks] = useState(false)

  const handleAnalyzeCentrality = async () => {
    setIsCentralityLoading(true)
    setHasSearchedCentrality(true)
    try {
      const text = blocks.map(b => b.content?.text || "").join("\n")
      if (!text.trim()) {
        toast.info("No text available to analyze.")
        setCentralityData([])
        return
      }
      const data = await calculateGraphCentrality({ data: { pieceId, blocksText: text } })
      setCentralityData(data || [])
      if (!data || data.length === 0) {
        toast.info("No central themes identified.")
      }
    } catch (e) {
      console.error(e)
      toast.error("Failed to analyze themes.")
    } finally {
      setIsCentralityLoading(false)
    }
  }

  const handleSuggestLinks = async () => {
    setIsLinksLoading(true)
    setHasSearchedLinks(true)
    try {
      const text = blocks.map(b => b.content?.text || "").join("\n")
      if (!text.trim()) {
        toast.info("No text available to analyze.")
        setLinksData([])
        return
      }
      const data = await suggestAutoLinks({ data: { pieceId, blocksText: text } })
      setLinksData(data || [])
      if (!data || data.length === 0) {
        toast.info("No related archival links found.")
      } else {
        toast.success(`Found ${data.length} potential links.`)
      }
    } catch (e) {
      console.error(e)
      toast.error("Failed to find links.")
    } finally {
      setIsLinksLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Centrality Section */}
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-sm text-foreground">
            <Network className="size-4 text-primary" />
            Theme Centrality
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Analyze your document&apos;s semantic graph to identify core thematic blocks.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleAnalyzeCentrality}
          disabled={isCentralityLoading}
          className="w-full justify-start"
        >
          {isCentralityLoading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Network className="mr-2 size-4" />
          )}
          Analyze Themes
        </Button>

        {centralityData.length > 0 ? (
          <div className="flex flex-col gap-2">
            {centralityData.map((item, i) => {
              // Ensure we sort of match blockId to the local uid since database id might map slightly differently in draft mode
              const block = blocks.find(b => b.id === item.blockId || b.uid === item.blockId)
              return (
                <button
                  key={i}
                  onClick={() => block && scrollToBlock(block.uid)}
                  className="flex flex-col items-start rounded border border-border/50 bg-background/50 p-2 text-left hover:bg-accent/50"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-medium text-foreground">
                      {item.keyTheme}
                    </span>
                    <span className="text-[10px] text-primary">
                      {Math.round(item.centralityScore * 100)}%
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {block?.content?.text || "Unknown block"}
                  </p>
                </button>
              )
            })}
          </div>
        ) : hasSearchedCentrality && !isCentralityLoading ? (
          <div className="text-xs text-muted-foreground p-2 text-center rounded border border-border/50 bg-background/50">
            No central themes could be identified.
          </div>
        ) : null}
      </div>

      <div className="h-px w-full bg-border/50" />

      {/* Auto-Links Section */}
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-sm text-foreground">
            <LinkIcon className="size-4 text-primary" />
            Auto-Links
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Suggest links to your past published pieces based on current claims.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSuggestLinks}
          disabled={isLinksLoading}
          className="w-full justify-start"
        >
          {isLinksLoading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <LinkIcon className="mr-2 size-4" />
          )}
          Find Links
        </Button>

        {linksData.length > 0 ? (
          <div className="flex flex-col gap-2">
            {linksData.map((item, i) => (
              <div
                key={i}
                className="flex flex-col items-start rounded border border-border/50 bg-background/50 p-2 text-left"
              >
                <span className="text-xs font-medium text-foreground">
                  &quot;{item.sourceText}&quot;
                </span>
                <div className="mt-1 flex w-full items-center justify-between text-[10px] text-muted-foreground">
                  <a
                    href={item.targetHandle ? `/u/${item.targetHandle}/${item.targetSlug}` : `/u/${item.targetSlug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline break-all"
                  >
                    /u/{item.targetHandle ?? "…"}/{item.targetSlug}
                  </a>
                  <span className="whitespace-nowrap ml-2">{(item.confidence * 100).toFixed(0)}% match</span>
                </div>
              </div>
            ))}
          </div>
        ) : hasSearchedLinks && !isLinksLoading ? (
          <div className="text-xs text-muted-foreground p-2 text-center rounded border border-border/50 bg-background/50">
            No related archival links found.
          </div>
        ) : null}
      </div>
    </div>
  )
}

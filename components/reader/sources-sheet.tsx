"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SourceCitation } from "@/lib/types/content"
import { Link2 } from "lucide-react"

export interface SegregatedSources {
  pieceSources: SourceCitation[]
  blockSources: SourceCitation[]
  commentSources: SourceCitation[]
}

export function SourcesSheet({
  open,
  onOpenChange,
  sources,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sources: SegregatedSources | SourceCitation[]
}) {
  const isSegregated = !Array.isArray(sources)
  
  const renderSourceItem = (s: SourceCitation, idx: number) => (
    <a
      key={`${s.url}-${idx}`}
      href={s.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-md p-3 transition-colors hover:bg-accent/40"
    >
      <div className="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary">
        <Link2 className="size-4" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground group-hover:underline">
          {s.title}
        </p>
        <p className="text-xs text-muted-foreground truncate max-w-70">
          {s.url}
        </p>
      </div>
    </a>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col h-full bg-background">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="font-display">Sources and citations</SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="flex-1 -mx-6 px-6 py-4">
          {isSegregated ? (
            <div className="space-y-8">
              {(sources as SegregatedSources).pieceSources.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground">
                    From the author
                  </h3>
                  <div className="space-y-1">
                    {(sources as SegregatedSources).pieceSources.map(renderSourceItem)}
                  </div>
                </div>
              )}
              {(sources as SegregatedSources).blockSources.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground">
                    Cited in the text
                  </h3>
                  <div className="space-y-1">
                    {(sources as SegregatedSources).blockSources.map(renderSourceItem)}
                  </div>
                </div>
              )}
              {(sources as SegregatedSources).commentSources.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground">
                    From comments
                  </h3>
                  <div className="space-y-1">
                    {(sources as SegregatedSources).commentSources.map(renderSourceItem)}
                  </div>
                </div>
              )}
              
              {!(sources as SegregatedSources).pieceSources.length && 
               !(sources as SegregatedSources).blockSources.length && 
               !(sources as SegregatedSources).commentSources.length && (
                <p className="text-sm text-muted-foreground italic text-center mt-10">
                  No sources available.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {(sources as SourceCitation[]).length > 0 ? (
                (sources as SourceCitation[]).map(renderSourceItem)
              ) : (
                <p className="text-sm text-muted-foreground italic text-center mt-10">
                  No sources available.
                </p>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

"use client"

import { Handle, Position } from "@xyflow/react"
import Link from "next/link"
import { Repeat, User } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Badge } from "@/components/ui/badge"

export function PieceNode({ data }: { data: Record<string, unknown> }) {
  const p = data.piece as { author?: { handle?: string, display_name?: string }, slug: string, title: string, reposted_from?: string }
  const handle = data.handle as string
  const label = p.author ? (p.author.display_name || p.author.handle || "Author") : p.title
  const nodeHref = p.author ? `/u/${p.author.handle || "user"}` : `/u/${handle}/${p.slug}`
  const pieceHref = `/u/${p.author?.handle || handle}/${p.slug}`

  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <HoverCard>
        <HoverCardTrigger asChild>
          <div className="group flex cursor-pointer flex-col items-center">
            <Link
              href={nodeHref}
              className="flex flex-col items-center"
              target={p.author ? "_blank" : undefined}
            >
              <div
                className={cn(
                  "flex items-center justify-center rounded-full border-2 shadow-sm transition-transform group-hover:scale-110",
                  p.author ? "h-8 w-8" : "h-11 w-11",
                  p.reposted_from
                    ? "border-note bg-note"
                    : p.author
                    ? "border-dashed border-border bg-muted"
                    : "border-info bg-info"
                )}
              >
                {p.reposted_from && (
                  <Repeat className="size-5 text-note-foreground" />
                )}
                {!p.reposted_from && p.author && (
                  <User className="size-4 text-muted-foreground" />
                )}
              </div>
              <span
                className={cn(
                  "mt-1 rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap shadow-sm backdrop-blur-sm",
                  p.author
                    ? "bg-muted/80 text-muted-foreground dark:bg-muted/80 dark:text-muted-foreground"
                    : "bg-background/80 text-foreground"
                )}
              >
                {label.length > 28 ? label.slice(0, 26) + "…" : label}
              </span>
            </Link>
          </div>
        </HoverCardTrigger>
        <HoverCardContent side="top" className="z-50 w-64 text-sm">
          <Link
            href={nodeHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            <h4
              className={cn(
                "font-semibold hover:underline",
                p.reposted_from
                  ? "text-note"
                  : p.author
                  ? "text-muted-foreground"
                  : "text-info"
              )}
            >
              {p.author ? `${p.author.display_name || p.author.handle}` : p.title}
            </h4>
          </Link>
          <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
            {p.reposted_from
              ? (data.originalAuthorName as string)
                ? `Reposted from ${data.originalAuthorName}. Click to view.`
                : "Click to view this reposted piece."
              : p.author
              ? <span>Original piece: <Link href={pieceHref} className="hover:underline" target="_blank">{p.title}</Link></span>
              : "Click to read this piece."}
          </p>
        </HoverCardContent>
      </HoverCard>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </>
  )
}

export function BranchNode({ data }: { data: Record<string, unknown> }) {
  const b = data.branch as { branch_type?: string, type?: string, purpose?: string, summary?: string }
  const href = data.href as string | null
  const badge = (
    <Badge
      variant="outline"
      className="border-success/30 bg-success/10 whitespace-nowrap text-success shadow-sm hover:bg-success/20"
    >
      {b.branch_type || b.type || "Branch"}
    </Badge>
  )
  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <HoverCard>
        <HoverCardTrigger asChild>
          {href ? (
            <Link href={href} className="cursor-pointer" aria-label={`Open ${b.branch_type || "branch"} branch`}>
              {badge}
            </Link>
          ) : (
            <div>{badge}</div>
          )}
        </HoverCardTrigger>
        <HoverCardContent side="top" className="z-50 w-64 text-sm">
          <h4 className="font-semibold text-success capitalize">
            {b.branch_type || b.type || "Branch"}
          </h4>
          {b.purpose && (
            <p className="mt-1 text-xs font-medium text-foreground">
              {b.purpose}
            </p>
          )}
          <p className="mt-2 text-muted-foreground">
            {b.summary || "No summary provided for this branch."}
          </p>
        </HoverCardContent>
      </HoverCard>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </>
  )
}

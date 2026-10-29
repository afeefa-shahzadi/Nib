import { Globe, Clock, Archive, Lock } from "lucide-react"
import React from "react"

// ─── Piece status display ─────────────────────────────────────────
export const PIECE_STATUS_ICON: Record<string, React.ReactNode> = {
  published: <Globe className="size-3 text-success" />,
  draft: <Clock className="size-3 text-muted-foreground" />,
  archived: <Archive className="size-3 text-note" />,
  scheduled: <Clock className="size-3 text-info" />,
  private: <Lock className="size-3 text-muted-foreground" />,
}

// ─── Branch types ─────────────────────────────────────────────────
export const BRANCH_TYPES = [
  "audio",
  "teaching",
  "premium",
  "debate",
  "localized",
] as const
export type BranchType = (typeof BRANCH_TYPES)[number]

// ─── Visibility levels ────────────────────────────────────────────
export const VISIBILITY_LEVELS = ["public", "member", "private"] as const
export type VisibilityLevel = (typeof VISIBILITY_LEVELS)[number]

// ─── Analytics mode colors ────────────────────────────────────────
export const MODE_COLOR: Record<string, string> = {
  standard: "var(--primary)",
  skim: "var(--note)",
  expert: "var(--success)",
  teach: "var(--info)",
  debate: "var(--destructive)",
}

// ─── Quest display labels ─────────────────────────────────────────
export const QUEST_LABELS: Record<string, string> = {
  read_3: "Read 3 pieces today",
  annotate_1: "Leave 1 annotation",
  clap_5: "Clap on 5 different pieces",
  follow_1: "Follow a new author",
  publish_1: "Publish 1 piece",
  reply_1: "Reply to a reader's annotation",
}

import { ReadingMode } from "@/components/block-renderer"

export const MODES: ReadingMode[] = [
  "skim",
  "standard",
  "expert",
  "teach",
  "debate",
]

export const MODE_HINT: Record<ReadingMode, string> = {
  skim: "Headline claims only",
  standard: "Default reading flow",
  expert: "Evidence + citations inline",
  teach: "Scaffolded for learners",
  debate: "Strongest objections, answered",
}

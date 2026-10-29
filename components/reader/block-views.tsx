// Barrel re-export – import individual blocks from their own files.
// This keeps block-renderer.tsx and all legacy imports working unchanged.
// CodeBlock (prism) and ChartBlock (recharts) are split out so pieces without them do not pay for them.
import dynamic from "next/dynamic"
export const CodeBlock = dynamic(() => import("./code-block").then((m) => m.CodeBlock))
export const ChartBlock = dynamic(() => import("./chart-block").then((m) => m.ChartBlock))

export {
  HeadingBlock,
  ParagraphBlock,
  QuoteBlock,
  CitationBlock,
  CalloutBlock,
  QuestionBlock,
} from "./text-blocks"
export { ImageBlock } from "./image-block"
export { ExerciseBlock } from "./exercise-block"
export { EmbedBlock, AudioNoteBlock } from "./media-blocks"
export { MermaidBlock } from "./mermaid-block"
export { FlowchartBlock } from "./flowchart-block"
export { MediaLightbox } from "./media-lightbox"

import { Input } from "@/components/ui/input"
import { Node, Edge } from "@xyflow/react"
import { FlowchartBuilder } from "./flowchart-builder"

interface Props {
  nodes: Node[]
  edges: Edge[]
  caption?: string
  onChange: (patch: {
    nodes?: Node[]
    edges?: Edge[]
    caption?: string
  }) => void
}

export function FlowchartBlockEditor({
  nodes,
  edges,
  caption,
  onChange,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="w-full">
        <FlowchartBuilder
          initialNodes={nodes}
          initialEdges={edges}
          onChange={(patch) => onChange(patch)}
        />
      </div>
      <Input
        value={caption ?? ""}
        onChange={(e) => onChange({ caption: e.target.value })}
        placeholder="Caption (optional)"
        className="h-7 text-xs"
      />
    </div>
  )
}

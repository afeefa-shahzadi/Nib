
"use client"

import { useMemo, useEffect, useState } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  Node,
  Edge,
  Handle,
  Panel,
  useReactFlow,
} from "@xyflow/react"
import dagre from "dagre"
import "@xyflow/react/dist/style.css"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Info } from "lucide-react"
import { useTheme } from "next-themes"
import type { BlockDraft } from "./types"
import { MODES, MODE_LABEL } from "./types"
import { htmlToText } from "./types"

function getPreviewText(b: BlockDraft): string {
  if (b.outlineLabel) return b.outlineLabel
  if (b.kind === "citation")
    return b.content.source || b.content.url || "(citation)"
  if (b.kind === "code") return b.content.text.split("\n")[0] || "(code)"
  if (b.kind === "heading") return b.content.text || "(heading)"
  const raw = b.content.html ? htmlToText(b.content.html) : b.content.text
  return raw || `(empty ${b.kind})`
}

export function BlockNode({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-card border-2 border-primary/20 min-w-50 text-center relative flex items-center justify-center min-h-10">
      <Handle type="target" position={Position.Top} className="w-2 h-2" />
      <div className="text-sm font-medium truncate max-w-45 text-foreground">
        {data.label as React.ReactNode}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2" />
      <Handle type="source" position={Position.Right} id="right" className="w-2 h-2 opacity-0" />
      <Handle type="source" position={Position.Left} id="left" className="w-2 h-2 opacity-0" />
    </div>
  )
}

export function ModeNode({ data }: { data: Record<string, unknown> }) {
  const MODE_DOT_COLOR: Record<string, string> = {
    skim: "var(--note)",
    standard: "var(--primary)",
    expert: "var(--success)",
    teach: "var(--info)",
    debate: "var(--destructive)",
  }
  const modeName = String(data.mode || "standard")
  const color = MODE_DOT_COLOR[modeName] || "var(--primary)"
  const targetPos = data.isLeft ? Position.Right : Position.Left

  return (
    <div 
      className="w-4 h-4 shadow-sm rounded-full border border-border/50 relative"
      style={{ backgroundColor: color }}
      title={String(data.label || "")}
    >
      <Handle type="target" position={targetPos} className="w-1 h-1 opacity-0" />
    </div>
  )
}

interface MinimapDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  blocks: BlockDraft[]
}

const nodeTypes = {
  blockNode: BlockNode,
  modeNode: ModeNode,
}

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = "TB") => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: direction, ranker: "longest-path" })

  const blockNodes = nodes.filter((n) => n.type === "blockNode")
  const modeNodes = nodes.filter((n) => n.type === "modeNode")

  blockNodes.forEach((node) => {
    dagreGraph.setNode(node.id, { 
      width: 220, 
      height: 60 
    })
  })

  edges.forEach((edge) => {
    if (edge.id.startsWith("seq-")) {
      dagreGraph.setEdge(edge.source, edge.target)
    }
  })

  dagre.layout(dagreGraph)

  const layoutedBlockNodes = blockNodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    return {
      ...node,
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
      position: {
        x: nodeWithPosition.x - 110,
        y: nodeWithPosition.y - 30,
      },
    }
  })

  const layoutedModeNodes = modeNodes.map((node) => {
    const parentEdge = edges.find((e) => e.target === node.id)
    const blockIdToUse = parentEdge ? parentEdge.source : ""
    const parentNode = layoutedBlockNodes.find((n) => n.id === blockIdToUse)
    
    const siblings = modeNodes.filter((n) => {
      const e = edges.find((e2) => e2.target === n.id)
      return e ? e.source === blockIdToUse : false
    })
    const siblingIndex = siblings.findIndex((n) => n.id === node.id)

    const isLeft = siblingIndex % 2 === 1
    const step = Math.floor(siblingIndex / 2)

    return {
      ...node,
      targetPosition: isLeft ? Position.Right : Position.Left,
      sourcePosition: isLeft ? Position.Left : Position.Right,
      position: {
        x: parentNode 
          ? (isLeft 
              ? parentNode.position.x - 30 - (step * 30) 
              : parentNode.position.x + 220 + 30 + (step * 30))
          : 0,
        y: parentNode ? parentNode.position.y + 10 : 0,
      },
      data: {
        ...node.data,
        isLeft
      }
    }
  })

  const layoutedEdges = edges.map((edge) => {
    if (edge.id.startsWith("mode-link-")) {
      const targetNode = layoutedModeNodes.find(n => n.id === edge.target)
      const isLeft = targetNode?.data?.isLeft
      return {
        ...edge,
        type: "default",
        sourceHandle: isLeft ? "left" : "right",
      }
    }
    return edge
  })

  return { nodes: [...layoutedBlockNodes, ...layoutedModeNodes], edges: layoutedEdges }
}

function MinimapLegend() {
  const [open, setOpen] = useState(false)

  const legendItems = [
    { mode: "skim", label: "Skim", color: "var(--note)" },
    { mode: "standard", label: "Standard", color: "var(--primary)" },
    { mode: "expert", label: "Expert", color: "var(--success)" },
    { mode: "teach", label: "Teach", color: "var(--info)" },
    { mode: "debate", label: "Debate", color: "var(--destructive)" },
  ]

  return (
    <Panel position="bottom-left" className="m-4">
      {/* Mobile Toggle */}
      <div className="md:hidden">
        <Button variant="outline" size="icon" className="rounded-full shadow-md bg-background/90 backdrop-blur" onClick={() => setOpen(!open)}>
          <Info className="w-4 h-4 text-foreground" />
        </Button>
      </div>

      {/* Legend Content */}
      <div className={`md:block bg-background/90 backdrop-blur shadow-md border rounded-md p-3 text-sm ${open ? "block mt-2" : "hidden"}`}>
        <div className="font-semibold mb-2 text-xs uppercase tracking-wider text-muted-foreground">Legend</div>
        <div className="flex flex-col gap-2">
          {legendItems.map((item) => (
            <div key={item.mode} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border border-border/50" style={{ backgroundColor: item.color }} />
              <span className="text-xs font-medium text-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

function MinimapRenderer({ blocks }: { blocks: BlockDraft[] }) {
  const { resolvedTheme } = useTheme()

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    const initialNodes: Node[] = []
    const initialEdges: Edge[] = []

    blocks.forEach((b, index) => {
      // 1. Create Block Node
      initialNodes.push({
        id: b.uid,
        type: "blockNode",
        position: { x: 0, y: 0 },
        data: { 
          label: getPreviewText(b),
          kind: b.kind,
          index: index + 1
        },
      })

      // 2. Link blocks sequentially
      if (index > 0) {
        initialEdges.push({
          id: `seq-${blocks[index - 1].uid}-${b.uid}`,
          source: blocks[index - 1].uid,
          target: b.uid,
          type: "smoothstep",
          style: { stroke: "var(--primary)", strokeWidth: 2, opacity: 0.3 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "var(--primary)",
          },
        })
      }

      // 3. Find and link modes for this block
      const validModes: string[] = []
      MODES.forEach(m => {
        if (m === "standard") {
          if (b.content.text || b.content.html || (b.content.files && b.content.files.length > 0) || b.content.imageUrl) {
            validModes.push("standard")
          }
        } else {
          if (b.content.aiVariants?.[m]) {
            validModes.push(m)
          }
        }
      })
      if (validModes.length === 0) validModes.push("standard")

      validModes.forEach(m => {
        const modeId = `${b.uid}-${m}`
        initialNodes.push({
          id: modeId,
          type: "modeNode",
          position: { x: 0, y: 0 },
          data: { 
            mode: m,
            label: MODE_LABEL[m as keyof typeof MODE_LABEL] || m
          },
        })
        
        initialEdges.push({
          id: `mode-link-${modeId}`,
          source: b.uid,
          target: modeId,
          type: "default",
          animated: true,
          style: { stroke: "var(--primary)", strokeWidth: 1.5, opacity: 0.5 },
        })
      })
    })

    return getLayoutedElements(initialNodes, initialEdges, "TB")
  }, [blocks])

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges)

  const { fitView } = useReactFlow()

  useEffect(() => {
    setNodes(layoutedNodes)
    setEdges(layoutedEdges)
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges])

  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.2, duration: 600 })
    }, 100)
    return () => clearTimeout(timer)
  }, [nodes, fitView])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      panOnDrag={true}
      zoomOnScroll={true}
      colorMode={resolvedTheme === "dark" ? "dark" : "light"}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={true}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} color="var(--border)" gap={16} />
      <MinimapLegend />
    </ReactFlow>
  )
}

export function MinimapDialog({ open, onOpenChange, blocks }: MinimapDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-[90vw] w-full h-[85vh] flex flex-col p-0 overflow-hidden gap-0 bg-background/95 backdrop-blur-md">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="font-display tracking-tight text-xl">Document Minimap</DialogTitle>
        </DialogHeader>
        <div className="flex-1 w-full h-full relative">
           <ReactFlowProvider>
             <MinimapRenderer blocks={blocks} />
           </ReactFlowProvider>
        </div>
      </DialogContent>
    </Dialog>
  )
}


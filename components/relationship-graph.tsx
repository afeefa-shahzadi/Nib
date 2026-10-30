/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useMemo, useEffect } from "react"
import {
  ReactFlow,
  Controls,
  ControlButton,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
  Node,
  Edge,
  Position
} from "@xyflow/react"
import dagre from "dagre"
import { Map as MapIcon } from "lucide-react"
import { useTheme } from "next-themes"
import "@xyflow/react/dist/style.css"
import {
  PieceGraphItem,
  BranchGraphItem,
  Relationship,
} from "@/lib/types/content"
import { PieceNode, BranchNode } from "./graph-nodes"
import { DatePickerWithRange } from "./date-range-picker"
import { DateRange } from "react-day-picker"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Props {
  handle: string
  pieces: PieceGraphItem[]
  branches: BranchGraphItem[]
  relationships: Relationship[]
}

const nodeTypes = {
  pieceNode: PieceNode,
  branchNode: BranchNode,
}

const NODE_W = 180
const NODE_H = 120

// Connected nodes go through dagre; unconnected ones would all land in dagre's
// first rank as one long row, so they're packed into a grid underneath instead.
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const linked = new Set(edges.flatMap((e) => [e.source, e.target]))
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: "TB", ranker: "longest-path", nodesep: 24, ranksep: 64 })
  nodes.filter((n) => linked.has(n.id)).forEach((n) => dagreGraph.setNode(n.id, { width: NODE_W, height: NODE_H }))
  edges.forEach((e) => dagreGraph.setEdge(e.source, e.target))
  dagre.layout(dagreGraph)

  const placed = nodes.filter((n) => linked.has(n.id)).map((n) => dagreGraph.node(n.id))
  const top = placed.length ? Math.max(...placed.map((p) => p.y)) + NODE_H : 0
  const loose = nodes.filter((n) => !linked.has(n.id))
  const cols = Math.min(4, Math.max(1, loose.length))

  const newNodes = nodes.map((node) => {
    const i = loose.indexOf(node)
    const pos =
      i === -1
        ? { x: dagreGraph.node(node.id).x - NODE_W / 2, y: dagreGraph.node(node.id).y - NODE_H / 2 }
        : { x: (i % cols) * NODE_W, y: top + Math.floor(i / cols) * NODE_H }
    return { ...node, targetPosition: Position.Top, sourcePosition: Position.Bottom, position: pos }
  })

  return { nodes: newNodes, edges }
}

export function RelationshipGraph({
  handle,
  pieces,
  branches,
  relationships,
}: Props) {
  const { resolvedTheme } = useTheme()
  const [showIsolated, setShowIsolated] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [typeFilter, setTypeFilter] = useState<"all" | "original" | "repost" | "branch">("all")
  const [pieceFilter, setPieceFilter] = useState<string>("all")
  const [showMap, setShowMap] = useState(false)

  // Generate unique pieces for the dropdown
  const uniquePieces = useMemo(() => {
    const map = new Map<string, string>()
    pieces.forEach(p => {
      if (!map.has(p.id)) map.set(p.id, p.title)
    })
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }))
  }, [pieces])

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    let nodes: Node[] = []
    let edges: Edge[] = []

    // Piece Nodes
    pieces.forEach((p) => {
      let originalAuthorName = undefined
      if (p.reposted_from) {
        const original = pieces.find((op) => op.id === p.reposted_from)
        originalAuthorName = original?.author?.display_name
      }
      nodes.push({
        id: p.id,
        type: "pieceNode",
        position: { x: 0, y: 0 },
        data: { piece: p, handle, originalAuthorName },
      })
    })

    // Branch Nodes
    // Branches have no page of their own; they're listed on the parent piece.
    branches.forEach((b) => {
      const parent = pieces.find((p) => p.id === b.parent_object_id)
      nodes.push({
        id: b.id,
        type: "branchNode",
        position: { x: 0, y: 0 },
        data: {
          branch: b,
          handle,
          href: parent ? `/u/${parent.author?.handle || handle}/${parent.slug}#branches` : null,
        },
      })
    })

    // Relationship Edges
    relationships.forEach((r) => {
      const isRepost = r.type === "repost"
      edges.push({
        id: r.id,
        source: r.from_object_id,
        target: r.to_object_id,
        type: isRepost ? "smoothstep" : "bezier",
        animated: isRepost,
        style: { 
          stroke: isRepost ? "var(--note)" : "var(--info)", 
          strokeWidth: isRepost ? 1.5 : 2,
          strokeDasharray: isRepost ? "4 4" : "none"
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isRepost ? "var(--note)" : "var(--info)",
        },
      })
    })

    // Branch Edges
    branches.forEach((b) => {
      edges.push({
        id: `branch-edge-${b.id}`,
        source: b.parent_object_id,
        target: b.id,
        type: "smoothstep",
        animated: true,
        style: { stroke: "var(--success)", strokeWidth: 1.5, strokeDasharray: "3 3" },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "var(--success)",
        },
      })
    })

    // --- Apply Filters ---

    // 1. Date Range Filter
    if (dateRange?.from) {
      const fromTime = dateRange.from.getTime()
      const toTime = dateRange.to ? dateRange.to.getTime() + 86400000 : Infinity // add 1 day to include end of day
      
      nodes = nodes.filter(n => {
        if (n.type === "pieceNode") {
          const pData = n.data.piece as { published_at?: string | null }
          const dateStr = pData.published_at
          if (!dateStr) return true
          const time = new Date(dateStr).getTime()
          return time >= fromTime && time <= toTime
        }
        if (n.type === "branchNode") {
          const bData = n.data.branch as { created_at?: string | null }
          const dateStr = bData.created_at
          if (!dateStr) return true
          const time = new Date(dateStr).getTime()
          return time >= fromTime && time <= toTime
        }
        return true
      })
    }

    // 2. Type Filter
    if (typeFilter !== "all") {
      nodes = nodes.filter(n => {
        if (typeFilter === "branch") return n.type === "branchNode"
        if (typeFilter === "original" || typeFilter === "repost") {
          if (n.type !== "pieceNode") return false
          const pData = n.data.piece as { reposted_from?: string | null }
          const isRepost = !!pData.reposted_from
          if (typeFilter === "repost") return isRepost
          if (typeFilter === "original") return !isRepost
        }
        return true
      })
    }

    // 3. Piece Filter (Subtree Downstream)
    if (pieceFilter !== "all") {
      const subtreeIds = new Set<string>([pieceFilter])
      let added = true
      while (added) {
        added = false
        for (const e of edges) {
          if (subtreeIds.has(e.source) && !subtreeIds.has(e.target)) {
            subtreeIds.add(e.target)
            added = true
          }
        }
      }
      nodes = nodes.filter(n => subtreeIds.has(n.id))
    }

    // Clean edges whose nodes were filtered out
    const finalNodeIds = new Set(nodes.map(n => n.id))
    edges = edges.filter(e => finalNodeIds.has(e.source) && finalNodeIds.has(e.target))

    // 4. Isolated Pieces Filter
    if (!showIsolated) {
      const connectedNodeIds = new Set<string>()
      edges.forEach(e => {
        connectedNodeIds.add(e.source)
        connectedNodeIds.add(e.target)
      })
      nodes = nodes.filter(n => connectedNodeIds.has(n.id))
    }

    return getLayoutedElements(nodes, edges)
  }, [pieces, branches, relationships, handle, showIsolated, dateRange, typeFilter, pieceFilter])

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges)

  useEffect(() => {
    setNodes(layoutedNodes)
    setEdges(layoutedEdges)
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges])

  if (pieces.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No published pieces to graph yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters Toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center p-4 bg-muted/20 border rounded-md">
        <div className="flex items-center space-x-2">
          <Switch
            id="isolated-toggle"
            checked={showIsolated}
            onCheckedChange={setShowIsolated}
          />
          <Label htmlFor="isolated-toggle" className="text-sm whitespace-nowrap">Show isolated nodes</Label>
        </div>

        <div className="hidden lg:block w-px h-6 bg-border mx-2" />

        <div className="flex flex-wrap gap-3 flex-1 items-center">
          <DatePickerWithRange date={dateRange} setDate={setDateRange} />

          <Select value={typeFilter} onValueChange={(v: "all" | "original" | "repost" | "branch") => setTypeFilter(v)}>
            <SelectTrigger className="w-35">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="original">Originals</SelectItem>
              <SelectItem value="repost">Reposts</SelectItem>
              <SelectItem value="branch">Branches</SelectItem>
            </SelectContent>
          </Select>

          <Select value={pieceFilter} onValueChange={setPieceFilter}>
            <SelectTrigger className="w-50 flex-1 max-w-75">
              <SelectValue placeholder="All pieces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All pieces</SelectItem>
              {uniquePieces.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title.length > 30 ? p.title.slice(0, 30) + "..." : p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="surface h-[min(600px,70vh)] w-full overflow-hidden rounded-md border p-0 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
          minZoom={0.4}
          colorMode={resolvedTheme === "dark" ? "dark" : "light"}
          proOptions={{ hideAttribution: true }}
          className="bg-background"
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          panOnDrag={true}
          zoomOnPinch={true}
        >
          <Controls>
            <ControlButton
              onClick={() => setShowMap(!showMap)}
              title={showMap ? "Hide minimap" : "Show minimap"}
              aria-label={showMap ? "Hide minimap" : "Show minimap"}
              aria-pressed={showMap}
            >
              <MapIcon />
            </ControlButton>
          </Controls>
          {showMap && <MiniMap
            position="top-right"
            zoomable 
            pannable 
            nodeColor={(n) => {
               if (n.type === 'pieceNode') {
                 const p = n.data.piece as { reposted_from?: string; author?: any }
                 if (p.reposted_from) return "var(--note)"
                 if (p.author) return "var(--muted-foreground)"
                 return "var(--info)"
               }
               return "var(--success)"
            }} 
            maskColor="color-mix(in oklab, var(--background) 60%, transparent)"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          />}
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="var(--border)" />
        </ReactFlow>
      </div>
    </div>
  )
}

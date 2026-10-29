"use client"

import React, { useCallback, useRef, useEffect } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Connection,
  Edge,
  Node,
  useReactFlow,
  Panel,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { flowchartNodeTypes } from "./flowchart-nodes"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"

import { nextNodeId } from "./flowchart-ids"

interface FlowchartBuilderProps {
  initialNodes: Node[]
  initialEdges: Edge[]
  onChange: (patch: { nodes?: Node[]; edges?: Edge[] }) => void
}

function FlowchartEditor({
  initialNodes,
  initialEdges,
  onChange,
}: FlowchartBuilderProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()
  const { resolvedTheme } = useTheme()
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Use a ref to track if changes came from initial load or user
  const isInitialLoad = useRef(true)

  // Keep the latest onChange in a ref. The parent recreates it every render, so
  // listing it in the autosave effect's deps re-armed the debounce timer on
  // every render — each fire wrote to Yjs, which re-rendered the parent, which
  // made a new onChange: a self-sustaining ~500ms write loop per flowchart.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const handleNodeDataChange = useCallback(
    (nodeId: string, newData: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: { ...node.data, ...newData },
            }
          }
          return node
        })
      )
    },
    [setNodes]
  )

  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      )
    },
    [setNodes, setEdges]
  )

  // Inject the change handlers into node data
  const nodesWithHandlers = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      onChange: handleNodeDataChange,
      onDelete: handleNodeDelete,
    },
  }))

  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false
      return
    }
    // Only fire onChange if user interacted (reduces unnecessary updates)
    const timer = setTimeout(() => {
      onChangeRef.current({
        nodes: nodes.map(({ id, type, position, data }) => ({
          id,
          type,
          position,
          data: {
            title: data.title,
            subtitle: data.subtitle,
            nodeStyle: data.nodeStyle,
          }, // Strip onChange function
        })),
        edges,
      })
    }, 500) // Debounce
    return () => clearTimeout(timer)
  }, [nodes, edges])

  const onConnect = useCallback(
    (params: Connection | Edge) =>
      setEdges((eds) => addEdge({ ...params, type: "smoothstep" }, eds)),
    [setEdges]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const transferData = event.dataTransfer.getData("application/reactflow")
      if (!transferData) return

      let parsed: { type: string; nodeStyle: string }
      try {
        parsed = JSON.parse(transferData)
      } catch {
        parsed = { type: transferData, nodeStyle: "secondary" }
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const newNode: Omit<Node, "id"> = {
        type: parsed.type,
        position,
        data: { title: "", subtitle: "", nodeStyle: parsed.nodeStyle },
      }

      setNodes((nds) => nds.concat({ ...newNode, id: nextNodeId(nds) }))
    },
    [screenToFlowPosition, setNodes]
  )

  // Mobile addition: Add node at center
  const addNodeAtCenter = (type: string) => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    const newNode: Omit<Node, "id"> = {
      type,
      position,
      data: { title: "", subtitle: "", nodeStyle: "secondary" },
    }
    setNodes((nds) => nds.concat({ ...newNode, id: nextNodeId(nds) }))
  }

  return (
    <div className="flex h-100 w-full overflow-hidden rounded-md border border-border bg-background">
      {/* Sidebar for Drag & Drop */}
      <div className="hidden w-40 flex-col gap-3 border-r border-border bg-muted/20 p-4 md:flex">
        <div className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Toolbox
        </div>
        <div
          className="flex cursor-grab flex-col items-center gap-2 rounded border border-border bg-background p-2 text-center text-xs shadow-sm active:cursor-grabbing"
          onDragStart={(e) => {
            e.dataTransfer.setData(
              "application/reactflow",
              JSON.stringify({ type: "sitemap", nodeStyle: "primary" })
            )
            e.dataTransfer.effectAllowed = "move"
          }}
          draggable
        >
          <div className="h-8 w-full rounded bg-primary opacity-80" />
          Primary Node
        </div>
        <div
          className="flex cursor-grab flex-col items-center gap-2 rounded border border-border bg-background p-2 text-center text-xs shadow-sm active:cursor-grabbing"
          onDragStart={(e) => {
            e.dataTransfer.setData(
              "application/reactflow",
              JSON.stringify({ type: "sitemap", nodeStyle: "secondary" })
            )
            e.dataTransfer.effectAllowed = "move"
          }}
          draggable
        >
          <div className="h-8 w-full rounded border border-border bg-card opacity-80" />
          Secondary Node
        </div>
        <p className="mt-auto text-[10px] leading-relaxed text-muted-foreground">
          Drag nodes onto the canvas to add them. Connect handles to link nodes.
        </p>
      </div>

      {/* Canvas */}
      <div className="relative flex-1" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodesWithHandlers}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={flowchartNodeTypes}
          fitView
          colorMode={resolvedTheme === "dark" ? "dark" : "light"}
          onlyRenderVisibleElements={true}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            type: "smoothstep",
            style: { strokeWidth: 2, stroke: "var(--color-primary)" },
          }}
          connectionLineStyle={{
            strokeWidth: 2,
            stroke: "var(--color-primary)",
          }}
        >
          <Controls />
          <Background color="var(--color-border)" gap={16} />

          {/* Mobile Toolbar (Visible only on small screens) */}
          <Panel position="top-right" className="md:hidden">
            <div className="flex flex-col gap-2 rounded border border-border bg-background p-2 shadow-md">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                Add Node
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => addNodeAtCenter("sitemap")}
              >
                + Add Node
              </Button>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  )
}

export function FlowchartBuilder(props: FlowchartBuilderProps) {
  return (
    <ReactFlowProvider>
      <FlowchartEditor {...props} />
    </ReactFlowProvider>
  )
}

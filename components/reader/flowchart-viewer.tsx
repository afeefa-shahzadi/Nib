"use client"

import React, { useMemo } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Node,
  Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { flowchartNodeTypes } from "../composer/flowchart-nodes"
import { useTheme } from "next-themes"

interface Props {
  nodes: Node[]
  edges: Edge[]
  className?: string
}

function FlowchartRenderer({ nodes, edges, className }: Props) {
  const { resolvedTheme } = useTheme()
  // We recreate the nodes but map them so they look exactly like they did in the editor
  // but without the interactivity callbacks
  const displayNodes = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      draggable: false,
      selectable: false,
      data: {
        ...node.data,
        // Empty onChange since it's view-only
        onChange: () => {},
      },
    }))
  }, [nodes])

  return (
    <div
      className={`flex w-full overflow-hidden rounded-md border border-border bg-background ${className ?? "h-100"}`}
    >
      <ReactFlow
        nodes={displayNodes}
        edges={edges}
        nodeTypes={flowchartNodeTypes}
        fitView
        panOnDrag={true}
        zoomOnScroll={true}
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: { strokeWidth: 2, stroke: "var(--color-primary)" },
        }}
      >
        <Background color="var(--color-border)" gap={16} />
      </ReactFlow>
    </div>
  )
}

export function FlowchartViewer(props: Props) {
  return (
    <ReactFlowProvider>
      <FlowchartRenderer {...props} />
    </ReactFlowProvider>
  )
}

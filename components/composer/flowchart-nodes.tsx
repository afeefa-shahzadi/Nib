import React, { memo } from "react"
import { Handle, Position } from "@xyflow/react"
import { Input } from "@/components/ui/input"
import { Home, Paintbrush, Trash2 } from "lucide-react"

interface NodeData {
  title?: string
  subtitle?: string
  nodeStyle?: "primary" | "secondary"
  onChange?: (id: string, data: NodeData) => void
  onDelete?: (id: string) => void
}

function SitemapNodeComponent({ data, id, isConnectable }: { data: NodeData, id: string, isConnectable: boolean }) {
  const onChangeTitle = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (data.onChange) data.onChange(id, { ...data, title: e.target.value })
  }

  const onChangeSubtitle = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (data.onChange) data.onChange(id, { ...data, subtitle: e.target.value })
  }

  const toggleStyle = () => {
    if (data.onChange)
      data.onChange(id, {
        ...data,
        nodeStyle: data.nodeStyle === "primary" ? "secondary" : "primary",
      })
  }

  const deleteNode = () => {
    if (data.onDelete) data.onDelete(id)
  }

  const isPrimary = data.nodeStyle === "primary"

  // If we are in view mode (no onChange), we render text. If edit mode, inputs.
  const isViewMode = !data.onChange

  return (
    <div
      className={`relative flex min-w-40 flex-col items-center justify-center rounded-md border p-3 shadow-sm transition-colors ${isPrimary ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-card-foreground"} `}
    >
      {/* Top Handle */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="h-3 w-3 border-2 !border-background !bg-primary transition-transform hover:scale-125"
      />

      {/* Optional Top Icon for Primary nodes */}
      {isPrimary && (
        <div className="absolute -top-4 rounded-full border-2 border-background bg-primary p-1 shadow-sm">
          <Home className="h-4 w-4 text-primary-foreground" />
        </div>
      )}

      {/* Style Toggle Button & Delete (Edit Mode Only) */}
      {!isViewMode && (
        <div className="absolute -top-2 -right-2 flex flex-col gap-1">
          <button
            onClick={toggleStyle}
            className="rounded-full border border-border bg-muted p-1.5 text-muted-foreground shadow transition-colors hover:bg-accent"
            title="Toggle Style"
          >
            <Paintbrush className="h-3 w-3" />
          </button>
          <button
            onClick={deleteNode}
            className="rounded-full border border-destructive/20 bg-destructive/10 p-1.5 text-destructive shadow transition-colors hover:bg-destructive hover:text-destructive-foreground"
            title="Delete Node"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}

      <div
        className={`mt-1 flex w-full flex-col text-center ${isPrimary && "mt-2"}`}
      >
        {isViewMode ? (
          <>
            <span className="text-sm font-semibold">
              {data.title || "Untitled"}
            </span>
            {data.subtitle && (
              <span
                className={`mt-1 text-[10px] ${isPrimary ? "text-primary-foreground/80" : "text-muted-foreground"}`}
              >
                {data.subtitle}
              </span>
            )}
          </>
        ) : (
          <>
            <Input
              className={`no-drag h-7 border-none bg-transparent px-1 text-center text-sm font-semibold shadow-none focus-visible:ring-1 ${isPrimary ? "text-primary-foreground placeholder:text-primary-foreground/50 focus-visible:ring-primary-foreground" : "placeholder:text-muted-foreground"}`}
              value={data.title || ""}
              onChange={onChangeTitle}
              placeholder="Node Name"
            />
            <Input
              className={`no-drag mt-1 h-5 border-none bg-transparent px-1 text-center text-[10px] shadow-none focus-visible:ring-1 ${isPrimary ? "text-primary-foreground placeholder:text-primary-foreground/50 focus-visible:ring-primary-foreground" : "placeholder:text-muted-foreground"}`}
              value={data.subtitle || ""}
              onChange={onChangeSubtitle}
              placeholder="Optional Subtitle"
            />
          </>
        )}
      </div>

      {/* Bottom Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="h-3 w-3 border-2 !border-background !bg-primary transition-transform hover:scale-125"
      />
    </div>
  )
}

export const SitemapNode = memo(SitemapNodeComponent)

export const flowchartNodeTypes = {
  sitemap: SitemapNode,
}

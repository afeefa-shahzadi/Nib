import { mergeAttributes, Node } from "@tiptap/core"
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react"
import Link from "next/link"
import Image from "next/image"

export interface InlineCitationOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineCitation: {
      /**
       * Insert an inline citation
       */
      setInlineCitation: (options: { url: string; label: string }) => ReturnType
    }
  }
}

export const InlineCitationNode = Node.create<InlineCitationOptions>({
  name: "inlineCitation",
  priority: 1000,
  group: "inline",
  inline: true,
  selectable: true,
  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      url: { 
        default: null,
        parseHTML: element => element.getAttribute('href') || element.getAttribute('url'),
      },
      label: { 
        default: null,
        parseHTML: element => element.getAttribute('data-label') || element.getAttribute('label'),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'cite[data-citation]',
      },
      {
        tag: 'a[data-citation]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const url = HTMLAttributes.url || "#"
    const label = HTMLAttributes.label || ""
    
    return [
      "cite",
      mergeAttributes(
        { 
          "data-citation": "true",
          "data-label": label,
          "data-url": url,
          class: "inline-flex items-center justify-center rounded-sm bg-primary/10 px-[3px] py-[1px] align-super text-[10px] font-semibold text-primary no-underline transition-colors hover:bg-primary/20 cursor-pointer not-italic",
        },
        HTMLAttributes
      ),
      label,
    ]
  },

  addCommands() {
    return {
      setInlineCitation:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          })
        },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineCitationComponent)
  },
})

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { useCitationContext } from "../citation-context"
import { useEffect, useState } from "react"
import { ExternalLink } from "lucide-react"

export function LinkPreview({ url, displayLabel }: { url: string; displayLabel?: string }) {
  const [data, setData] = useState<{ title?: string; description?: string; image?: string; logo?: string; url?: string } | null>(null)
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!url || url === "#") return
    
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d)
        setFetchedUrl(url)
      })
      .catch(() => {
        setFetchedUrl(url)
      })
  }, [url])

  const loading = url && url !== "#" && fetchedUrl !== url;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold">{displayLabel ? `Reference [${displayLabel}]` : ""}</h4>
      </div>
      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      ) : data?.title ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block border rounded-lg overflow-hidden hover:bg-muted/50 transition-colors">
          {data.image && (
            <Image unoptimized width={600} height={128} src={data.image} alt={data.title} className="w-full h-32 object-cover" style={{ width: "auto" }} />
          )}
          <div className="p-3 space-y-2">
            <div className="flex items-start gap-2">
              {data.logo && !data.image && (
                <Image unoptimized width={20} height={20} src={data.logo} alt="" className="w-5 h-5 object-contain rounded-sm mt-0.5" style={{ width: "auto" }} />
              )}
              <h5 className="text-sm font-semibold line-clamp-2">{data.title}</h5>
            </div>
            {data.description && <p className="text-xs text-muted-foreground line-clamp-2">{data.description}</p>}
            <p className="text-xs text-primary flex items-center gap-1 mt-1">
              <ExternalLink className="h-3 w-3" />
              <span className="truncate">{url}</span>
            </p>
          </div>
        </a>
      ) : (
        <a 
          href={url || "#"} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline break-all"
        >
          {url}
        </a>
      )}
    </div>
  )
}

function InlineCitationComponent(props: {
  node: { attrs: { label?: string; url?: string } }
}) {
  const { label, url } = props.node.attrs
  const { map } = useCitationContext()
  const displayLabel = (url ? map.get(url) : null) || label || "?"

  return (
    <NodeViewWrapper as="span" className="mx-0.5 inline-block align-baseline" contentEditable={false}>
      <HoverCard>
        <HoverCardTrigger asChild>
          <Link
            href={url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-sm bg-primary/10 px-0.75 py-px align-super text-[10px] font-semibold text-primary no-underline transition-colors hover:bg-primary/20"
          >
            {displayLabel}
          </Link>
        </HoverCardTrigger>
        <HoverCardContent side="top" className="w-80">
          <LinkPreview url={url || "#"} displayLabel={displayLabel} />
        </HoverCardContent>
      </HoverCard>
    </NodeViewWrapper>
  )
}

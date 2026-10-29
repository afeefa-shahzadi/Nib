import { mergeAttributes, Node } from "@tiptap/core"
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react"
import Link from "next/link"

export interface MentionOptions {
  HTMLAttributes: Record<string, unknown>
}

export const MentionNode = Node.create<MentionOptions>({
  name: "mention",
  group: "inline",
  inline: true,
  selectable: false,
  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    // Older saves rendered the attrs as bare id/label/href attributes on an
    // empty span — still parse those.
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-id") ?? el.getAttribute("id"),
        renderHTML: (a) => (a.id ? { "data-id": a.id } : {}),
      },
      label: {
        default: null,
        parseHTML: (el) =>
          el.getAttribute("data-label") ?? el.getAttribute("label") ?? el.textContent,
        renderHTML: (a) => (a.label ? { "data-label": a.label } : {}),
      },
      href: {
        default: null,
        parseHTML: (el) => el.getAttribute("href"),
        renderHTML: (a) => (a.href ? { href: a.href } : {}),
      },
    }
  },

  parseHTML() {
    return [
      // Above the Link mark (priority 50) so a mention isn't parsed as a link.
      { tag: 'a[data-type="mention"]', priority: 100 },
      { tag: 'span[data-type="mention"]' },
    ]
  },

  // The saved HTML is what readers see: emit the label as a link. An empty
  // span (the old output) made every @mention and [[link]] vanish on save.
  renderHTML({ node, HTMLAttributes }) {
    return [
      node.attrs.href ? "a" : "span",
      mergeAttributes(
        { "data-type": "mention" },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      node.attrs.label ?? "",
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MentionComponent)
  },
})

function MentionComponent(props: {
  node: { attrs: { label?: string; href?: string } }
}) {
  const { label, href } = props.node.attrs

  return (
    <NodeViewWrapper as="span" className="mx-0.5 inline-block align-baseline">
      <Link
        href={href || "#"}
        target="_blank"
        rel="noopener noreferrer"
        contentEditable={false}
        className="rounded-md bg-primary/10 px-1.5 py-0.5 text-sm font-medium text-primary no-underline transition-colors hover:bg-primary/20"
      >
        {label}
      </Link>
    </NodeViewWrapper>
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Link from "@tiptap/extension-link"
import Highlight from "@tiptap/extension-highlight"
import Typography from "@tiptap/extension-typography"
import Collaboration from "@tiptap/extension-collaboration"
import { useEffect, useRef, useState, useMemo } from "react"
import { Bold, Italic, Strikethrough, Code, Link2, Link2Off, Highlighter } from "lucide-react"
import { cn } from "@/lib/utils"
import { LinkPickerDialog } from "./link-picker-dialog"
import { CitationPickerPopover } from "./citation-picker-dialog"
import { useCitationContext } from "./citation-context"
import { InlineMentionMenu, type InlineHit } from "./inline-mention-menu"
import { MentionNode } from "./extensions/mention-node"
import { InlineCitationNode } from "./extensions/inline-citation-node"
import { Quote } from "lucide-react"

// applyLink builds raw <a> HTML and feeds it to insertContent, which bypasses
// tiptap's own link validation. The reader sanitizes on render (DOMPurify), but
// keep junk schemes and unescaped text out of what we store in the first place.
const escHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
  )

const safeUrl = (u: string) => {
  const t = u.trim()
  // Allow http(s), mailto, tel, in-page/relative links.
  if (/^(https?:|mailto:|tel:|\/|#|\?)/i.test(t)) return t
  // Bare domains (example.com/x) → assume https.
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(t)) return `https://${t}`
  // Reject javascript:, data:, vbscript:, etc.
  return "#"
}

interface Props {
  value: string
  onChange: (html: string, text: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  onFocus?: () => void
  /** Detect "/" at start of empty block to open slash menu. */
  onSlashTrigger?: (rect: DOMRect, query: string) => void
  /** The "/query" match ended (space typed, caret moved, text deleted): close the menu. */
  onSlashClose?: () => void
  ydoc?: any
  provider?: any
  currentUser?: any
  blockUid?: string
}

// The text editor the user was last typing in. The composer's toolbar
// Undo/Redo (the only undo on phones) routes here before structural undo.
export const lastTextEditor: { current: Editor | null } = { current: null }

export function RichBlockEditor({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
  onFocus,
  onSlashTrigger,
  onSlashClose,
  ydoc,
  provider,
  currentUser,
  blockUid,
}: Props) {
  const { map: citationMap, nextLabel } = useCitationContext()
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkInitial, setLinkInitial] = useState<{ url: string; text: string }>(
    { url: "", text: "" }
  )
  const [citationOpen, setCitationOpen] = useState(false)
  const [citationInitial, setCitationInitial] = useState<{ url: string; label: string }>(
    { url: "", label: "" }
  )
  const [mention, setMention] = useState<{
    anchor: { x: number; y: number }
    trigger: "@" | "[["
    query: string
    /** Absolute doc position where the trigger char(s) begin (inclusive). */
    from: number
  } | null>(null)

  const prevText = useRef("")

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        link: false,
        blockquote: false,
        horizontalRule: false,
        undoRedo: ydoc ? false : undefined,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Write, or press / for blocks…",
      }),
      Link.extend({
        parseHTML() {
          return [
            {
              tag: 'a[href]:not([data-type="inline-citation"]):not([data-type="mention"])',
            },
          ]
        }
      }).configure({
        openOnClick: false,
        HTMLAttributes: { class: "underline decoration-primary" },
      }),
      Highlight,
      Typography,
      MentionNode,
      InlineCitationNode,
      ...(ydoc && blockUid ? [
        Collaboration.configure({
          document: ydoc,
          field: blockUid,
        }),
      ] : []),
    ],
    [placeholder, ydoc, blockUid, provider, currentUser]
  )

  const editor = useEditor({
    extensions,
    content: value,
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    onCreate: ({ editor }) => {
      // With Collaboration enabled tiptap takes the editor's state from the
      // shared document and ignores `content`. That document is created fresh
      // for each composer session and nothing seeds it, so opening a saved
      // block for editing showed an empty editor — and its first update wrote
      // that emptiness back over the stored text. Seed the block's fragment
      // here, before any update can fire.
      if (!ydoc || !blockUid) return
      const fragment = ydoc.getXmlFragment(blockUid)
      if (fragment.length === 0 && value) {
        editor.commands.setContent(value, { emitUpdate: false })
      }
    },
    onUpdate: ({ editor }) => {
      // Mounting the view renders the (still empty) collab fragment over the
      // block's content and tiptap reports that as an update. Passing it on
      // overwrote the stored text with "<p></p>" before onCreate could seed the
      // fragment — and autosave persisted the emptiness. Nothing before
      // initialization is a user edit.
      if (!editor.isInitialized) return
      const html = editor.getHTML()
      const text = editor.getText()
      onChange(html, text)
      const $from = editor.state.selection.$from
      const offset = $from.parentOffset
      // Inline slash command / @mention / [[wiki]] triggers — re-evaluate every keystroke.
      const upto = $from.parent.textBetween(0, offset, "\n", "\n")
      const slashMatch = /(?:^|\s)\/([A-Za-z0-9_-]{0,20})$/.exec(upto)
      const wiki = /\[\[([^\[\]\n]{0,80})$/.exec(upto)
      const ment = /(?:^|\s)@([A-Za-z0-9_]{0,40})$/.exec(upto)

      if (onSlashTrigger && slashMatch) {
        // from position unused but trigger handled below
        const sel = window.getSelection()
        const range = sel?.rangeCount ? sel.getRangeAt(0) : null
        const rect = range?.getBoundingClientRect()
        if (rect) onSlashTrigger(rect, slashMatch[1])
      } else if (onSlashTrigger) {
        onSlashClose?.()
      }

      let next: typeof mention = null
      if (wiki) {
        const triggerLen = wiki[0].length
        const from = $from.pos - triggerLen
        const sel = window.getSelection()
        const range = sel?.rangeCount ? sel.getRangeAt(0) : null
        const rect = range?.getBoundingClientRect()
        if (rect)
          next = {
            anchor: { x: rect.left, y: rect.bottom },
            trigger: "[[",
            query: wiki[1],
            from,
          }
      } else if (ment) {
        const triggerLen = ment[0].startsWith(" ")
          ? ment[0].length - 1
          : ment[0].length
        const from = $from.pos - triggerLen
        const sel = window.getSelection()
        const range = sel?.rangeCount ? sel.getRangeAt(0) : null
        const rect = range?.getBoundingClientRect()
        if (rect)
          next = {
            anchor: { x: rect.left, y: rect.bottom },
            trigger: "@",
            query: ment[1],
            from,
          }
      }
      setMention(next)
      prevText.current = text
    },
    onFocus: ({ editor }) => {
      lastTextEditor.current = editor
      onFocus?.()
    },
    onDestroy: () => {
      if (lastTextEditor.current?.isDestroyed) lastTextEditor.current = null
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none text-foreground focus:outline-none",
          "min-h-[1.75rem]",
          className
        ),
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== value) {
      setTimeout(() => {
        editor?.commands.setContent(value || "", { emitUpdate: false })
      }, 0)
    }
  }, [value, editor])

  const openLink = () => {
    if (!editor) return
    const existing = editor.getAttributes("link")?.href as string | undefined
    const { from, to, empty } = editor.state.selection
    const text = empty ? "" : editor.state.doc.textBetween(from, to, " ")
    setLinkInitial({ url: existing ?? "", text })
    setLinkOpen(true)
  }

  const applyLink = ({ url, text }: { url: string; text?: string }) => {
    if (!editor) return
    const href = safeUrl(url)
    const { from, to, empty } = editor.state.selection
    const chain = editor.chain().focus()
    if (empty && text) {
      chain.insertContent(`<a href="${href}">${escHtml(text)}</a>`).run()
    } else if (
      !empty &&
      text &&
      text !== editor.state.doc.textBetween(from, to, " ")
    ) {
      chain
        .deleteRange({ from, to })
        .insertContent(`<a href="${href}">${escHtml(text)}</a>`)
        .run()
    } else if (!empty) {
      chain.extendMarkRange("link").setLink({ href }).run()
    } else {
      chain.insertContent(`<a href="${href}">${escHtml(href)}</a>`).run()
    }
    setLinkOpen(false)
  }

  const removeLink = () => {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run()
    setLinkOpen(false)
  }

  const openCitation = () => {
    if (!editor) return
    const isActive = editor.isActive("inlineCitation")
    if (isActive) {
      const attrs = editor.getAttributes("inlineCitation")
      setCitationInitial({ url: attrs.url || "", label: attrs.label || "" })
    } else {
      setCitationInitial({ url: "", label: "" })
    }
    setCitationOpen(true)
  }

  const applyCitation = ({ url }: { url: string }) => {
    // Determine the label: existing if known, else next available
    const finalLabel = citationMap.get(url) || nextLabel
    editor?.chain().focus().setInlineCitation({ url, label: finalLabel }).run()
    setCitationOpen(false)
  }

  const removeCitation = () => {
    if (editor?.isActive("inlineCitation")) {
      editor.commands.deleteSelection()
    }
    setCitationOpen(false)
  }

  const tBtn = (active: boolean) =>
    cn(
      "inline-flex size-7 items-center justify-center rounded text-xs hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
      active && "bg-accent text-accent-foreground"
    )

  return (
    <div className="relative">
      {editor && (
        <BubbleMenu
          editor={editor}
          className="flex items-center gap-0.5 rounded-md border border-border bg-background p-1 shadow-md"
        >
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              editor.chain().focus().toggleBold().run()
            }}
            className={tBtn(editor.isActive("bold"))}
            title="Bold (Ctrl/Cmd+B)"
            aria-label="Bold"
          >
            <Bold className="size-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              editor.chain().focus().toggleItalic().run()
            }}
            className={tBtn(editor.isActive("italic"))}
            title="Italic"
            aria-label="Italic"
          >
            <Italic className="size-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              editor.chain().focus().toggleStrike().run()
            }}
            className={tBtn(editor.isActive("strike"))}
            title="Strikethrough"
            aria-label="Strikethrough"
          >
            <Strikethrough className="size-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              editor.chain().focus().toggleCode().run()
            }}
            className={tBtn(editor.isActive("code"))}
            title="Inline code"
            aria-label="Inline code"
          >
            <Code className="size-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              editor.chain().focus().toggleHighlight().run()
            }}
            className={tBtn(editor.isActive("highlight"))}
            title="Highlight"
            aria-label="Highlight"
          >
            <Highlighter className="size-3.5" />
          </button>
          <span className="mx-1 h-3 w-px bg-border" />
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              openLink()
            }}
            className={tBtn(editor.isActive("link"))}
            title="Insert / edit link"
            aria-label="Insert link"
          >
            <Link2 className="size-3.5" />
          </button>
          {editor.isActive("link") && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                removeLink()
              }}
              className={tBtn(false)}
              title="Remove link"
              aria-label="Remove link"
            >
              <Link2Off className="size-3.5" />
            </button>
          )}
          <span className="mx-1 h-3 w-px bg-border" />
          <CitationPickerPopover
            open={citationOpen}
            onClose={() => setCitationOpen(false)}
            initialUrl={citationInitial.url}
            initialLabel={citationInitial.label}
            onConfirm={applyCitation}
            onRemove={citationInitial.url ? removeCitation : undefined}
          >
            <button
              type="button"
              onClick={openCitation}
              className={tBtn(editor.isActive("inlineCitation"))}
              title="Citation"
            >
              <Quote className="size-3.5" />
            </button>
          </CitationPickerPopover>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
      <LinkPickerDialog
        open={linkOpen}
        initialUrl={linkInitial.url}
        initialText={linkInitial.text}
        onClose={() => setLinkOpen(false)}
        onConfirm={applyLink}
        onRemove={removeLink}
      />
      {mention && editor && (
        <InlineMentionMenu
          anchor={mention.anchor}
          trigger={mention.trigger}
          query={mention.query}
          onClose={() => setMention(null)}
          onSelect={(hit: InlineHit) => {
            const to = editor.state.selection.$from.pos
            editor
              .chain()
              .focus()
              .deleteRange({ from: mention.from, to })
              .insertContent({
                type: "mention",
                attrs: { id: hit.id, label: hit.label, href: hit.href },
              })
              .insertContent(" ")
              .run()
            setMention(null)
          }}
        />
      )}
    </div>
  )
}

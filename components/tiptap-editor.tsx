"use client"

import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Link from "@tiptap/extension-link"
import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { MentionNode } from "./composer/extensions/mention-node"

interface Props {
  value: string
  onChange: (text: string) => void
  placeholder?: string
  className?: string
  minHeight?: number
}

export function TiptapEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = 80,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
      Placeholder.configure({ placeholder: placeholder ?? "Write…" }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "underline" },
      }),
      MentionNode,
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none",
          "rounded-md border border-input bg-background px-3 py-2"
        ),
        style: `min-height:${minHeight}px`,
      },
    },
  })

  // Sync external value changes (e.g. AI-generated replacement)
  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== value)
      editor.commands.setContent(value || "", { emitUpdate: false })
  }, [value, editor])

  return <EditorContent editor={editor} className={className} />
}

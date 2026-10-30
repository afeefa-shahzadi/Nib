"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Mention from "@tiptap/extension-mention"
import Placeholder from "@tiptap/extension-placeholder"
import { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion"
import { ReactRenderer } from "@tiptap/react"
import tippy, { Instance as TippyInstance } from "tippy.js"
import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type ProfileItem = { id: string; handle: string; display_name: string; avatar_url: string | null }

// Component for rendering the mention suggestion list
const MentionList = forwardRef((props: SuggestionProps<ProfileItem>, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectItem = (index: number) => {
    const item = props.items[index]
    if (item) props.command({ id: item.handle, label: item.handle })
  }

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length)
  }

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length)
  }

  const enterHandler = () => {
    selectItem(selectedIndex)
  }

  const [prevItems, setPrevItems] = useState(props.items)
  if (props.items !== prevItems) {
    setPrevItems(props.items)
    setSelectedIndex(0)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        upHandler()
        return true
      }
      if (event.key === "ArrowDown") {
        downHandler()
        return true
      }
      if (event.key === "Enter") {
        enterHandler()
        return true
      }
      return false
    },
  }))

  return (
    <div className="bg-popover border border-border rounded-md shadow-md overflow-hidden min-w-50">
      {props.items.length ? (
        props.items.map((item, index) => (
          <button
            key={item.id}
            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent ${
              index === selectedIndex ? "bg-accent" : ""
            }`}
            onClick={() => selectItem(index)}
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={item.avatar_url || ""} />
              <AvatarFallback>{item.display_name?.charAt(0) || item.handle?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-medium text-foreground">{item.display_name}</span>
              <span className="text-xs text-muted-foreground">@{item.handle}</span>
            </div>
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-sm text-muted-foreground">
          {props.query ? "No one by that name" : "Type a name to mention someone"}
        </div>
      )}
    </div>
  )
})
MentionList.displayName = "MentionList"

const suggestion: Omit<SuggestionOptions, "editor"> = {
  // Like Instagram: a bare "@" offers people you follow; typing searches
  // handles and names, with people you follow ranked first.
  items: async ({ query }) => {
    const q = query.replace(/[^\p{L}\p{N}_.-]/gu, "")
    const { data: auth } = await supabase.auth.getSession()
    const me = auth.session?.user.id
    const { data: follows } = me
      ? await supabase.from("follows").select("author_id").eq("follower_id", me).limit(500)
      : { data: [] }
    const followed = new Set((follows ?? []).map((f) => f.author_id as string))
    const cols = "id, handle, display_name, avatar_url"
    if (!q) {
      if (!followed.size) return []
      const { data } = await supabase.from("profiles").select(cols).in("id", [...followed].slice(0, 50)).limit(6)
      return data ?? []
    }
    const { data } = await supabase
      .from("profiles")
      .select(cols)
      .or(`handle.ilike.${q}%,display_name.ilike.${q}%,display_name.ilike.% ${q}%`)
      .neq("id", me ?? "")
      .limit(20)
    return (data ?? [])
      .sort((a, b) => Number(followed.has(b.id)) - Number(followed.has(a.id)))
      .slice(0, 6)
  },
  render: () => {
    let component: ReactRenderer
    let popup: TippyInstance[]

    return {
      onStart: (props) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        })
        if (!props.clientRect) return
        popup = tippy("body", {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
        })
      },
      onUpdate(props) {
        component.updateProps(props)
        if (!props.clientRect) return
        popup[0].setProps({
          getReferenceClientRect: props.clientRect as () => DOMRect,
        })
      },
      onKeyDown(props) {
        if (props.event.key === "Escape") {
          popup[0].hide()
          return true
        }
        return (component.ref as { onKeyDown?: (p: typeof props) => boolean })?.onKeyDown?.(props) || false
      },
      onExit() {
        popup[0].destroy()
        component.destroy()
      },
    }
  },
}

export interface CommentEditorRef {
  insertMention: (id: string, label: string) => void
  focus: () => void
}

export const CommentEditor = forwardRef<
  CommentEditorRef,
  {
    value: string
    onChange: (html: string) => void
    onSubmit: () => void
    disabled?: boolean
    placeholder?: string
  }
>(({ value, onChange, onSubmit, disabled, placeholder = "Write a response..." }, ref) => {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
      }),
      Mention.configure({
        HTMLAttributes: {
          class: "bg-primary/20 text-primary font-medium rounded-sm px-1 cursor-pointer hover:bg-primary/30 transition-colors",
        },
        suggestion,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[60px] p-3 border border-border rounded-md bg-transparent",
        placeholder,
      },
      handleKeyDown: (view, event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          // When the @mention popup is open, Enter must pick the highlighted
          // user, not submit the comment. ProseMirror runs these direct
          // editorProps before plugin keymaps, so without this guard the
          // suggestion plugin never saw Enter. The mention extension registers
          // its suggestion plugin with an unnamed PluginKey, so detect it by
          // its state shape instead of a key name.
          const mentionOpen = view.state.plugins.some((p) => {
            const st = (p as { getState?: (s: typeof view.state) => unknown }).getState?.(view.state)
            return (
              !!st &&
              typeof st === "object" &&
              "active" in st &&
              "range" in st &&
              "composing" in st &&
              (st as { active: boolean }).active
            )
          })
          if (mentionOpen) return false
          event.preventDefault()
          if (!disabled) onSubmit()
          return true
        }
        return false
      },
    },
  })

  useImperativeHandle(ref, () => ({
    insertMention: (id, label) => {
      if (!editor) return
      editor.chain().focus().insertContent({
        type: "mention",
        attrs: { id, label }
      }).insertContent(" ").run()
    },
    focus: () => editor?.commands.focus()
  }))

  useEffect(() => {
    if (editor && editor.getHTML() !== value && value === "") {
      editor.commands.setContent("")
    }
  }, [value, editor])

  return (
    <div className={`relative ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <EditorContent editor={editor} />
    </div>
  )
})
CommentEditor.displayName = "CommentEditor"

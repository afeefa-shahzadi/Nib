"use client"
import { Link as LinkIcon } from "lucide-react"
import { toast } from "sonner"

async function copyAnchor(id: string) {
  if (typeof window === "undefined") return
  const url = `${window.location.origin}${window.location.pathname}#${id}`
  try {
    await navigator.clipboard.writeText(url)
    toast.success("Link copied", { description: url })
  } catch {
    toast.error("Couldn't copy", {
      description: "Your browser blocked clipboard access.",
    })
  }
}

export function SectionHeader({
  id,
  eyebrow,
  title,
}: {
  id: string
  eyebrow?: string
  title: string
}) {
  return (
    <div className="group relative">
      {eyebrow && (
        <p className="mb-2 text-sm font-medium text-primary">
          {eyebrow}
        </p>
      )}
      <div className="flex items-center gap-2">
        <h2 className="font-display text-3xl md:text-4xl">{title}</h2>
        <button
          type="button"
          onClick={() => copyAnchor(id)}
          aria-label={`Copy link to ${title}`}
          title="Copy link to this section"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent hover:text-primary focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        >
          <LinkIcon className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

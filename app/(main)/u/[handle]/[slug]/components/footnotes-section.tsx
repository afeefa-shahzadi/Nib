import { Asterisk } from "lucide-react"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { type Block, sanitize } from "@/components/block-renderer"

interface FootnotesSectionProps {
  footnotes: Block[]
}

export function FootnotesSection({ footnotes }: FootnotesSectionProps) {
  if (footnotes.length === 0) return null

  return (
    <section className="hairline-t mt-16 pt-6">
      <h2 className="mb-4 inline-flex items-center gap-2 font-display text-xl text-foreground">
        <Asterisk className="size-4 text-primary" /> Footnotes
      </h2>
      <ol className="list-decimal space-y-3 pl-5 text-sm text-muted-foreground marker:text-primary">
        {footnotes.map((f) => {
          const html =
            typeof f.content.html === "string" ? f.content.html : null
          const text = typeof f.content.text === "string" ? f.content.text : ""
          return (
            <li key={f.id ?? text.slice(0, 16)}>
              <HoverCard openDelay={120}>
                <HoverCardTrigger asChild>
                  <span className="cursor-help underline decoration-primary/40 decoration-dotted underline-offset-2">
                    {text.length > 80
                      ? text.slice(0, 80) + "…"
                      : text || "footnote"}
                  </span>
                </HoverCardTrigger>
                <HoverCardContent className="w-80 text-sm">
                  {html ? (
                    <span dangerouslySetInnerHTML={{ __html: sanitize(html) }} />
                  ) : (
                    text
                  )}
                </HoverCardContent>
              </HoverCard>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

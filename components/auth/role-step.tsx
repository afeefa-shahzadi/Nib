import { Button } from "@/components/ui/button"
import { BookOpen, PenLine, Building2 } from "lucide-react"

export type AccountRole = "reader" | "creator" | "organization"

interface Props {
  onSelect: (role: AccountRole) => void
  mode: "signup" | "signin"
}

export function RoleStep({ onSelect, mode }: Props) {
  return (
    <div>
      <h1 className="font-display text-3xl text-foreground">
        {mode === "signup" ? "How will you use Nib?" : "Welcome back"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {mode === "signup"
          ? "Pick a starting point — you can do both later."
          : "Where would you like to land?"}
      </p>

      <div className="mt-6 grid gap-3">
        <button
          type="button"
          onClick={() => onSelect("reader")}
          className="hairline group rounded-lg p-5 text-left transition-colors hover:border-primary/60 hover:bg-accent/40"
        >
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 size-5 text-primary" />
            <div>
              <p className="font-display text-lg text-foreground group-hover:text-primary">
                I&apos;m a reader
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Follow authors, tip pieces, jump into debates.
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelect("creator")}
          className="hairline group rounded-lg p-5 text-left transition-colors hover:border-primary/60 hover:bg-accent/40"
        >
          <div className="flex items-start gap-3">
            <PenLine className="mt-0.5 size-5 text-primary" />
            <div>
              <p className="font-display text-lg text-foreground group-hover:text-primary">
                I&apos;m an author
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Publish adaptive pieces, run tiers, host debates.
              </p>
            </div>
          </div>
        </button>

        {mode === "signup" && (
          <button
            type="button"
            onClick={() => onSelect("organization")}
            className="hairline group rounded-lg p-5 text-left transition-colors hover:border-primary/60 hover:bg-accent/40"
          >
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 size-5 text-primary" />
              <div>
                <p className="font-display text-lg text-foreground group-hover:text-primary">
                  We&apos;re an organization
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Educational institutions, businesses, and labs.
                </p>
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  )
}

export function RoleBadge({
  role,
  onChange,
}: {
  role: AccountRole
  onChange: () => void
}) {
  return (
    <div className="mb-5 flex items-center justify-between text-xs">
      <span className="hairline inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-muted-foreground">
        {role === "reader" ? (
          <BookOpen className="size-3" />
        ) : role === "creator" ? (
          <PenLine className="size-3" />
        ) : (
          <Building2 className="size-3" />
        )}
        {role === "reader" ? "Reader" : role === "creator" ? "Author" : "Organization"}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onChange}
        className="h-7 px-2 text-xs"
      >
        Change
      </Button>
    </div>
  )
}

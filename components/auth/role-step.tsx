import { BookOpen, PenLine, Building2 } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export type AccountRole = "reader" | "creator" | "organization"

const ROLES: { value: AccountRole; label: string; Icon: typeof BookOpen }[] = [
  { value: "reader", label: "Reader", Icon: BookOpen },
  { value: "creator", label: "Author", Icon: PenLine },
  { value: "organization", label: "Organization", Icon: Building2 },
]

// One row of choices at the top of the form, instead of a whole screen before it.
export function RolePicker({
  value,
  onChange,
  label,
}: {
  value: AccountRole
  onChange: (r: AccountRole) => void
  label: string
}) {
  const roles = ROLES
  return (
    <div>
      <p id="role-label" className="text-sm font-medium">{label}</p>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as AccountRole)}
        aria-labelledby="role-label"
        className="mt-2 grid w-full grid-cols-3 gap-2"
      >
        {roles.map(({ value: v, label: l, Icon }) => (
          <ToggleGroupItem
            key={v}
            value={v}
            className="h-auto min-h-11 flex-col gap-1 rounded-md border border-border px-1 py-2 text-sm max-sm:text-xs data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary sm:flex-row sm:gap-2 lg:min-h-10"
          >
            <Icon className="size-4" aria-hidden />
            {l}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { passwordStrength } from "@/lib/password-strength"
import { cn } from "@/lib/utils"

// Password field with a show/hide button and, for new passwords, a strength hint.
export function PasswordInput({
  id,
  value,
  onChange,
  isNew,
  invalid,
  describedBy,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  isNew?: boolean
  invalid?: boolean
  describedBy?: string
}) {
  const [shown, setShown] = useState(false)
  const s = passwordStrength(value)
  return (
    <>
      <div className="relative">
        <Input
          id={id}
          type={shown ? "text" : "password"}
          required
          minLength={isNew ? 8 : undefined}
          autoComplete={isNew ? "new-password" : "current-password"}
          placeholder={isNew ? "At least 8 characters" : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={[describedBy, isNew && value ? `${id}-strength` : null].filter(Boolean).join(" ") || undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-12"
        />
        <button
          type="button"
          onClick={() => setShown(!shown)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          className="absolute top-0 right-0 inline-flex size-11 items-center justify-center text-muted-foreground hover:text-foreground lg:size-9"
        >
          {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
      {isNew && value && (
        <div id={`${id}-strength`} className="mt-2 flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <span className="flex flex-1 gap-1" aria-hidden>
            {[1, 2, 3, 4].map((n) => (
              <span
                key={n}
                className={cn(
                  "h-1 flex-1 rounded-full bg-muted",
                  n <= s.level && (s.level <= 1 ? "bg-destructive" : s.level === 2 ? "bg-note" : "bg-success")
                )}
              />
            ))}
          </span>
          {s.label}
        </div>
      )}
    </>
  )
}

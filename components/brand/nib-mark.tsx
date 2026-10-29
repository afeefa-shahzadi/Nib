import { cn } from "@/lib/utils"

/** Nib mark (E1 straight): two tines meeting at the point. Decorative; label the wrapping link. */
export function NibMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={cn("size-5", className)}>
      <path d="M5 3h6.4L12 21Z" />
      <path d="M12.6 3H19L12 21Z" />
    </svg>
  )
}

/** Mark + lowercase wordmark, as used in the header and footer. */
export function NibLogo() {
  return (
    <>
      <NibMark className="text-primary" />
      <span className="font-display text-xl leading-none tracking-tight">nib</span>
    </>
  )
}

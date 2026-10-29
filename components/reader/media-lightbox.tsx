"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function MediaLightbox({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-200 flex animate-in items-center justify-center bg-black/80 backdrop-blur-sm duration-200 fade-in"
      onClick={onClose}
    >
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="size-5" />
      </Button>
      <div
        className="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

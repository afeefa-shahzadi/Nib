import { Skeleton } from "@/components/ui/skeleton"

// Placeholder for a studio page or list while its data loads.
export function StudioSkeleton({ rows = 5, header = true }: { rows?: number; header?: boolean }) {
  return (
    <div className="space-y-4 py-2" aria-busy="true" aria-label="Loading">
      {header && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      )}
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  )
}

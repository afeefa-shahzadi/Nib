import Link from "next/link"

// Root not-found: renders for any notFound() call and for any URL that matches
// no route in the app (Next routes unmatched requests here), returning a 404.
export default function NotFound() {
  return (
    <main className="flex min-h-[80vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="text-5xl" aria-hidden="true">
          🍄
        </div>
        <div className="space-y-2">
          <p className="font-display text-6xl leading-none text-primary">404</p>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            This page grew elsewhere
          </h1>
          <p className="text-sm text-muted-foreground">
            The page you’re after doesn’t exist, moved, or was never published.
            Nothing to read here yet.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Back home
          </Link>
          <Link
            href="/feed"
            className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Explore the feed
          </Link>
        </div>
      </div>
    </main>
  )
}

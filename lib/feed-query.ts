// Turns the feed's sort / time / page choices into query bounds.
export const FEED_PAGE_SIZE = 20
const MAX_PAGE = 50
const DAY = 86_400_000
const WINDOWS = { week: 7 * DAY, month: 30 * DAY, year: 365 * DAY } as const

export type FeedSort = "newest" | "oldest"
export type FeedSince = "any" | keyof typeof WINDOWS

export function feedWindow(
  opts: { sort?: FeedSort; since?: FeedSince; page?: number },
  now = Date.now()
): { ascending: boolean; from: number; to: number; since: string | null } {
  const page = Math.min(MAX_PAGE, Math.max(0, Math.floor(Number(opts.page) || 0)))
  const span = opts.since && opts.since in WINDOWS ? WINDOWS[opts.since as keyof typeof WINDOWS] : null
  return {
    ascending: opts.sort === "oldest",
    from: page * FEED_PAGE_SIZE,
    // Inclusive range: one extra row tells the caller whether another page exists.
    to: page * FEED_PAGE_SIZE + FEED_PAGE_SIZE,
    since: span ? new Date(now - span).toISOString() : null,
  }
}

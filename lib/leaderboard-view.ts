// Ranks leaderboard rows by one score, then searches, re-sorts and pages them.
// Ranks come from the score alone, so searching or sorting never renumbers people.
export const LB_PAGE_SIZE = 25

type Row = { userId: string; displayName: string; handle: string | null; authorName?: string }

export function rankView<T extends Row>(
  rows: T[],
  opts: { key: keyof T & string; sort?: keyof T & string; dir?: "asc" | "desc"; q?: string; page?: number; viewerId?: string | null }
) {
  const num = (r: T, k: keyof T) => Number(r[k]) || 0
  const ranked = [...rows]
    .sort((a, b) => num(b, opts.key) - num(a, opts.key) || a.displayName.localeCompare(b.displayName))
    .map((r, i) => ({ ...r, rank: i + 1 }))

  const q = (opts.q ?? "").trim().toLowerCase()
  let list = q
    ? ranked.filter((r) => [r.displayName, r.handle, r.authorName].some((s) => (s ?? "").toLowerCase().includes(q)))
    : ranked
  const sort = opts.sort && opts.sort !== opts.key ? opts.sort : null
  const dir = opts.dir ?? "desc"
  if (sort || dir === "asc") {
    const k = sort ?? opts.key
    list = [...list].sort((a, b) => (dir === "asc" ? num(a, k) - num(b, k) : num(b, k) - num(a, k)))
  }

  const pages = Math.max(1, Math.ceil(list.length / LB_PAGE_SIZE))
  const page = Math.min(pages - 1, Math.max(0, Math.floor(opts.page ?? 0)))
  const me = opts.viewerId ? ranked.find((r) => r.userId === opts.viewerId) ?? null : null
  const ahead = me && me.rank > 1 ? ranked[me.rank - 2] : null

  return {
    rows: list.slice(page * LB_PAGE_SIZE, (page + 1) * LB_PAGE_SIZE),
    total: ranked.length,
    matches: list.length,
    page,
    pages,
    // The podium only makes sense on the plain ranking.
    podium: !q && !sort && dir === "desc" && page === 0 ? ranked.slice(0, 3) : [],
    me: me && { rank: me.rank, toNext: ahead ? num(ahead, opts.key) - num(me, opts.key) + 1 : 0 },
  }
}

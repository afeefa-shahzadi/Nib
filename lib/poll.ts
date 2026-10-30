// Turns raw vote choices into per-option counts and whole-number percentages
// that always add up to 100 (largest remainder), in the poll's option order.
// `choices` is the raw votes or a precounted choice -> count map.
export function tallyPoll(options: string[], choices: string[] | Map<string, number>) {
  const counts = options.map((o) => (Array.isArray(choices) ? choices.filter((c) => c === o).length : choices.get(o) ?? 0))
  const total = counts.reduce((a, b) => a + b, 0)
  if (!total) return { total, rows: options.map((option) => ({ option, count: 0, percent: 0 })) }
  const raw = counts.map((c) => (c * 100) / total)
  const percents = raw.map(Math.floor)
  let left = 100 - percents.reduce((a, b) => a + b, 0)
  raw
    .map((r, i) => [r - Math.floor(r), i] as const)
    .sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => left-- > 0 && percents[i]++)
  return { total, rows: options.map((option, i) => ({ option, count: counts[i], percent: percents[i] })) }
}

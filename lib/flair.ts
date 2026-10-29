// Flair catalog — the Insight Points sink. Each flair is a profile name colour
// bought once with IP (non-cashable), then equippable for free. Pure data; the
// `class` is a Tailwind text-colour applied to the display name wherever a
// flair-aware name is rendered. Keep ids stable — they're stored on profiles.

export type Flair = {
  id: string
  name: string
  cost: number // Insight Points
  className: string
}

export const FLAIRS: Flair[] = [
  { id: "sage", name: "Sage Green", cost: 200, className: "text-emerald-500" },
  { id: "ember", name: "Ember", cost: 400, className: "text-orange-500" },
  { id: "rose", name: "Rose", cost: 400, className: "text-rose-500" },
  { id: "sky", name: "Sky", cost: 800, className: "text-sky-500" },
  { id: "violet", name: "Violet", cost: 1200, className: "text-violet-500" },
  { id: "gold", name: "Gold", cost: 2000, className: "text-amber-500" },
]

export const FLAIR_BY_ID = new Map(FLAIRS.map((f) => [f.id, f]))

/** Tailwind class for an equipped flair id, or "" for none/unknown. */
export function flairClass(id: string | null | undefined): string {
  return (id && FLAIR_BY_ID.get(id)?.className) || ""
}

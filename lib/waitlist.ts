export const WAITLIST_ITEMS = [
  "studio",
  "reader_pass",
  "org",
  "tip",
  "membership",
  "sponsorship",
] as const
export type WaitlistItem = (typeof WAITLIST_ITEMS)[number]

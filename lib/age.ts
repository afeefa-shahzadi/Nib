// Whole years from a YYYY-MM-DD date of birth, or null if it doesn't parse.
export function ageOn(dob: string, now = new Date()): number | null {
  const b = new Date(dob)
  if (!dob || Number.isNaN(b.getTime())) return null
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

export const MIN_AGE = 13
export const ADULT_AGE = 18

// Sign-ups aged 13–17 need a parent's approval before they can publish or post.
export function needsParentalConsent(dob: string, now = new Date()): boolean {
  const a = ageOn(dob, now)
  return a !== null && a >= MIN_AGE && a < ADULT_AGE
}

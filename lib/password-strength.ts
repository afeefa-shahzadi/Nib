// A rough hint for the sign-up form, not a security control (Supabase enforces the minimum).
const COMMON = ["password", "123456", "qwerty", "letmein", "welcome", "iloveyou", "admin", "nib"]
const LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"] as const

export function passwordStrength(pw: string): { level: 0 | 1 | 2 | 3 | 4; label: (typeof LABELS)[number] } {
  if (pw.length < 8) return { level: 0, label: LABELS[0] }
  if (COMMON.some((c) => pw.toLowerCase().includes(c))) return { level: 1, label: LABELS[1] }
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length
  const level = Math.min(4, 1 + (pw.length >= 12 ? 1 : 0) + (classes >= 3 ? 2 : classes >= 2 ? 1 : 0)) as 1 | 2 | 3 | 4
  return { level, label: LABELS[level] }
}

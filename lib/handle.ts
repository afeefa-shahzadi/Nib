// Public handles: /u/<handle>. Lowercase letters, numbers and underscores.
export const HANDLE_RE = /^[a-z0-9_]{3,30}$/

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?"
}

"use client"
import { useSyncExternalStore } from "react"
import { Accessibility, Bell, BookOpen, KeyRound, PenLine, Shield, Trash2, User, Wallet } from "lucide-react"

// Settings sections, shown in the studio sidebar (Vercel-style) and picked by the URL hash.
export const SETTINGS_SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "account", label: "Account and sign-in", icon: KeyRound },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "reading", label: "Reading and display", icon: BookOpen },
  { id: "writing", label: "Writing and AI", icon: PenLine },
  { id: "plan", label: "Plan and payouts", icon: Wallet },
  { id: "data", label: "Privacy and data", icon: Shield },
  { id: "accessibility", label: "Accessibility", icon: Accessibility },
  { id: "delete", label: "Delete account", icon: Trash2 },
] as const
export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"]

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb)
  return () => window.removeEventListener("hashchange", cb)
}

export function useSettingsSection(): SettingsSectionId {
  const h = useSyncExternalStore(subscribe, () => window.location.hash.slice(1), () => "")
  return SETTINGS_SECTIONS.some((s) => s.id === h) ? (h as SettingsSectionId) : "profile"
}

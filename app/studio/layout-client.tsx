"use client"

import { NibLogo } from "@/components/brand/nib-mark"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useMyRole, type StudioRole } from "@/hooks/use-my-role"
import { useMyPlan } from "@/hooks/use-my-plan"
import { hasStudioAccess } from "@/lib/plan"
import { getMyProfile } from "@/actions/content"
import { unreadCount } from "@/actions/social"
import { listMyOrgs } from "@/actions/orgs"
import { tickReadingStreak } from "@/actions/monetization"
import { supabase } from "@/lib/supabase/client"
import Link from "next/link"
import Image from "next/image"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LayoutDashboard,
  FileText,
  GitBranch,
  TrendingUp,
  MessagesSquare,
  Trophy,
  Award,
  Folder,
  Network,
  Coins,
  Users,
  Package,
  Compass,
  Building2,
  Bell,
  Settings,
  BookOpen,
  LogOut,
  Globe,
  Menu,
  UserPlus,
  Lock,
} from "lucide-react"
import { ArrowLeft } from "lucide-react"
import { SETTINGS_SECTIONS, useSettingsSection, type SettingsSectionId } from "@/lib/settings-sections"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// Settings swaps the studio links for its own sections, with a way back (like Vercel).
function SettingsNav({ section, onPick }: { section: SettingsSectionId; onPick: () => void }) {
  return (
    <div className="space-y-4">
      <Link
        href="/studio"
        onClick={onPick}
        className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground lg:min-h-9"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to studio
      </Link>
      <p className="px-3 font-display text-lg text-foreground">Settings</p>
      <nav aria-label="Settings sections" className="space-y-0.5">
        {SETTINGS_SECTIONS.map(({ id, label, icon: Icon }) => {
          const active = section === id
          return (
            <a
              key={id}
              href={`#${id}`}
              onClick={onPick}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-all duration-150 lg:min-h-9 ${
                active
                  ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-sm"
                  : id === "delete"
                    ? "text-destructive/80 hover:bg-sidebar-accent/50 hover:text-destructive"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className={`size-4 ${active ? "text-primary" : ""}`} aria-hidden />
              {label}
            </a>
          )
        })}
      </nav>
    </div>
  )
}

export default function StudioLayoutClient({
  children,
  initialRole,
}: {
  children: React.ReactNode
  initialRole?: StudioRole | null
}) {
  const pathname = usePathname()
  const inSettings = pathname.startsWith("/studio/settings")
  const settingsSection = useSettingsSection()
  const router = useRouter()
  const { isAuthor } = useMyRole(initialRole)
  const { plan } = useMyPlan()
  const [mobileOpen, setMobileOpen] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)

  // The nav can be taller than the sidebar; make sure the active item is
  // scrolled into view instead of hidden at the bottom edge under the footer.
  useEffect(() => {
    navRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "center" })
  }, [pathname, isAuthor])

  const hasStudio = hasStudioAccess(plan)
  const hasOrg = plan === "org"

  const getProfileFn = getMyProfile
  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getProfileFn(),
  })
  const profile = profileQuery.data

  const listOrgsFn = listMyOrgs
  const orgsQuery = useQuery({
    queryKey: ["my-orgs"],
    queryFn: () => listOrgsFn(),
  })
  const orgs = orgsQuery.data ?? []

  const [activeOrgId, setActiveOrgId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return window.localStorage.getItem("studio:active_org") || null
  })

  useEffect(() => {
    if (activeOrgId) {
      window.localStorage.setItem("studio:active_org", activeOrgId)
    } else {
      window.localStorage.removeItem("studio:active_org")
    }
  }, [activeOrgId])

  // Auto-tick streak on every studio session open.
  // The server action is idempotent: it skips if already ticked today.
  useEffect(() => {
    tickReadingStreak().catch(() => {})
  }, [])

  const unreadFn = unreadCount
  const unreadQuery = useQuery({
    queryKey: ["unread-notifications-count"],
    queryFn: () => unreadFn(),
    refetchInterval: 60_000,
  })
  const notificationsCount = unreadQuery.data?.unread ?? 0

  const isComposer =
    pathname.startsWith("/studio/drafts/") && pathname !== "/studio/drafts"

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  if (isComposer) {
    return <>{children}</>
  }

  type NavLink = {
    href: string
    label: string
    icon: React.ElementType
    badge?: number
    locked?: boolean
  }

  // Build the list of navigation links based on user role
  const groups: { title: string; links: NavLink[] }[] = isAuthor
    ? [
      {
        title: "Workspace",
        links: [
          { href: "/studio", label: "Dashboard", icon: LayoutDashboard },
          { href: "/studio/drafts", label: "Pieces", icon: FileText },
          {
            href: "/studio/network",
            label: "Creator Network",
            icon: UserPlus,
          },
          { href: "/studio/graph", label: "Content Graph", icon: Network },
        ],
      },
      {
        title: "Content",
        links: [
          { href: "/studio/branches", label: "Branches", icon: GitBranch },
          {
            href: "/studio/debates",
            label: "Debate Rooms",
            icon: MessagesSquare,
          },
          { href: "/studio/quests", label: "Quests", icon: Compass },
          { href: "/studio/leaderboard", label: "Leaderboard", icon: Trophy },
          { href: "/studio/collections", label: "Collections", icon: Folder },
        ],
      },
      {
        title: "Monetization",
        links: [
          { href: "/studio/analytics", label: "Analytics", icon: TrendingUp, locked: !hasStudio },
          { href: "/studio/earnings", label: "Earnings", icon: Coins },
          { href: "/studio/tiers", label: "Membership Tiers", icon: Award, locked: !hasStudio },
          { href: "/studio/bundles", label: "Bundles", icon: Package, locked: !hasStudio },
          { href: "/studio/org", label: "Organizations", icon: Building2, locked: !hasOrg },
        ],
      },
      {
        title: "System",
        links: [
          {
            href: "/studio/notifications",
            label: "Notifications",
            icon: Bell,
            badge: notificationsCount,
          },
          { href: "/studio/memberships", label: "My Memberships", icon: Users },
          { href: "/studio/settings", label: "Settings", icon: Settings },
        ],
      },
    ]
    : [
      {
        title: "",
        links: [
          { href: "/studio", label: "Reading Desk", icon: BookOpen },
          { href: "/studio/memberships", label: "My Memberships", icon: Users },
          {
            href: "/studio/notifications",
            label: "Notifications",
            icon: Bell,
            badge: notificationsCount,
          },
          { href: "/studio/settings", label: "Settings", icon: Settings },
        ],
      },
    ]

  const renderSidebarContent = () => (
    <div className="flex h-full scrollbar-thumb-sidebar-accent scrollbar-track-sidebar flex-col bg-sidebar text-sidebar-foreground">
      {/* Branding */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-sidebar-border px-6 py-4">
        <Link href="/" className="group flex items-center gap-1.5">
          <NibLogo />
          <span className="font-display text-lg leading-none tracking-tight text-muted-foreground">
            studio
          </span>
        </Link>
        {isAuthor && orgs.length > 0 && (
          <Select
            value={activeOrgId || "personal"}
            onValueChange={(val) => {
              const newVal = val === "personal" ? null : val
              setActiveOrgId(newVal)
              const url = new URL(window.location.href)
              if (newVal) url.searchParams.set("org", newVal)
              else url.searchParams.delete("org")
              router.replace(url.pathname + url.search)
            }}
          >
            <SelectTrigger
              aria-label="Select Organization"
              className="h-8 w-full rounded border-sidebar-border bg-sidebar-accent px-2 text-xs text-sidebar-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="personal">Personal Workspace</SelectItem>
              {orgs
                .filter((o) => o.org)
                .map((o) => (
                  <SelectItem key={o.org!.id} value={o.org!.id}>
                    {o.org!.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Navigation Links */}
      {/* min-h-0 lets this flex child actually shrink+scroll instead of pushing the footer over it. */}
      <div ref={navRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-6">
        {inSettings ? (
          <SettingsNav section={settingsSection} onPick={() => setMobileOpen(false)} />
        ) : groups.map((group, idx) => (
          <div key={idx} className="space-y-1">
            {group.title && (
              <p className="mb-2 px-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                {group.title}
              </p>
            )}
            <nav className="space-y-0.5">
              {group.links.map((link) => {
                const Icon = link.icon
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    data-active={isActive}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150 ${isActive
                      ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      }`}
                  >
                    <Icon
                      className={`size-4 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"}`}
                    />
                    <span className="flex-1 truncate">{link.label}</span>
                    {link.badge !== undefined && link.badge > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                        {link.badge > 99 ? "99+" : link.badge}
                      </span>
                    )}
                    {link.locked && (
                      <Lock className="ml-auto size-3 text-muted-foreground/60" />
                    )}
                  </Link>
                )
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Footer Profile Section */}
      <div className="border-t border-sidebar-border bg-sidebar-accent/35 p-4">
        {profile ? (
          <div className="flex items-center gap-3">
            <div className="relative size-9 shrink-0 overflow-hidden rounded-full border border-sidebar-border bg-muted">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt=""
                  width={36}
                  height={36}
                  className="size-full object-cover"
                />
              ) : (
                <div className="grid size-full place-items-center bg-muted text-sm font-medium text-muted-foreground">
                  {(profile.display_name ?? "?").charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <p className="truncate text-xs leading-tight font-semibold text-sidebar-foreground">
                  {profile.display_name}
                </p>
                <span className="inline-flex shrink-0 items-center rounded-sm bg-primary/10 px-1 text-[9px] font-bold uppercase tracking-widest text-primary">
                  LVL {profile.level || 1}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 mt-1">
                <p className="truncate text-[10px] text-muted-foreground">
                  @{profile.handle}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-note">
                    {profile.xp || 0} XP
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={signOut}
              className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              title="Sign Out"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        ) : (
          <div className="h-9 w-full animate-pulse rounded bg-muted/20" />
        )}
        <div className="mt-3">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 rounded-md border border-sidebar-border py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          >
            <Globe className="size-3" />
            <span>Go to Main Site</span>
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="animate-fade-in flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar (Sticky, Left side) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar select-none lg:flex">
        {renderSidebarContent()}
      </aside>

      {/* Main Content Pane */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Header (Sticky top, only visible on small viewports) */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
          <Link href="/" className="group flex items-center gap-1.5">
            <NibLogo />
          </Link>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              className="relative size-11 cursor-pointer rounded-md p-2 text-foreground hover:bg-accent"
            >
              <Link href="/studio/notifications" aria-label="Notifications">
                <Bell className="size-5" />
                {!!notificationsCount && (
                  <Badge
                    variant="default"
                    className="absolute top-2 right-2 size-2 rounded-full bg-destructive"
                  />
                )}
              </Link>
            </Button>

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button aria-label="Open menu" className="flex size-11 cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-accent">
                  <Menu className="size-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 border-r-0 p-0">
                <SheetTitle className="sr-only">Studio Navigation</SheetTitle>
                <SheetDescription className="sr-only">
                  Navigate the Nib Studio features
                </SheetDescription>
                {renderSidebarContent()}
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Studio Page Content */}
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}

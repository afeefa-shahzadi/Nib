"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import dynamic from "next/dynamic"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowUp, Menu, Moon, Search, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { NibLogo } from "@/components/brand/nib-mark"
import {
  GithubIcon,
  InstagramIcon,
  LinkedinIcon,
  TwitterIcon,
  YoutubeIcon,
} from "@/components/brand/social-icons"

// Mounted on first open so cmdk and the search actions stay out of the first-load bundle.
const SearchPalette = dynamic(
  () => import("@/components/search-palette").then((m) => m.SearchPalette),
  { ssr: false }
)

// Signed-in only: keep the bell (and its popover/realtime code) out of the first-load bundle.
const NotificationsBell = dynamic(
  () => import("@/components/notifications-bell").then((m) => m.NotificationsBell),
  { ssr: false }
)

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label="Toggle theme"
      className="size-11 lg:size-9"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
    </Button>
  )
}

type Me = { handle: string | null; name: string; avatar: string | null }

// Visitors get "How it works"; writing starts from "Get started". Signed-in users get "Write".
const navFor = (signedIn: boolean) => [
  { href: "/feed", label: "Read" },
  signedIn ? { href: "/studio", label: "Write" } : { href: "/product", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
]

const isActive = (path: string, href: string) =>
  path === href || path.startsWith(href + "/")

export function SiteHeader() {
  const [me, setMe] = useState<Me | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchUsed, setSearchUsed] = useState(false)
  const router = useRouter()

  const openSearch = () => {
    setSearchUsed(true)
    setSearchOpen(true)
  }

  // ⌘K / Ctrl+K anywhere, and "/" when not typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault()
        openSearch()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  const path = usePathname() ?? "/"

  useEffect(() => {
    // supabase-js (~220KB) is loaded after hydration, off the critical path.
    let unsub: (() => void) | undefined
    let cancelled = false
    import("@/lib/supabase/client").then(({ supabase }) => {
      if (cancelled) return
      // Fires once on subscribe with the current session, then on every change.
      const { data } = supabase.auth.onAuthStateChange((_e, s) => {
        const user = s?.user
        if (!user) return setMe(null)
        // Defer: awaiting Supabase calls inside this callback can deadlock auth.
        setTimeout(async () => {
          const { data: p } = await supabase
            .from("profiles")
            .select("handle, display_name, avatar_url")
            .eq("id", user.id)
            .maybeSingle()
          if (cancelled) return
          setMe({
            handle: p?.handle ?? null,
            name: p?.display_name || p?.handle || user.email || "Account",
            avatar: p?.avatar_url ?? null,
          })
        })
      })
      unsub = () => data.subscription.unsubscribe()
    })
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [])

  const signOut = async () => {
    const { supabase } = await import("@/lib/supabase/client")
    await supabase.auth.signOut()
    router.push("/")
  }

  const account = me
    ? [
        ...(me.handle ? [{ href: `/u/${me.handle}`, label: "Your profile" }] : []),
        { href: "/studio", label: "Studio" },
        { href: "/collections", label: "Collections" },
        { href: "/me/earnings", label: "Earnings" },
        { href: "/studio/settings", label: "Settings" },
      ]
    : []

  const close = () => setMenuOpen(false)
  const NAV = navFor(!!me)

  return (
    <header className="hairline-b sticky top-0 z-30 bg-background/80 backdrop-blur-md">
      <div className="container-wide flex h-16 items-center justify-between gap-2">
        <Link prefetch={false} href="/" aria-label="Nib home" className="group -my-2 flex items-center gap-1.5 py-3">
          <NibLogo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-6 text-sm lg:flex">
          {NAV.map((l) => (
            <Link prefetch={false}
              key={l.href}
              href={l.href}
              aria-current={isActive(path, l.href) ? "page" : undefined}
              className="text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Search (Ctrl K)"
            title="Search (Ctrl K)"
            className="size-11 lg:size-9"
            onClick={openSearch}
          >
            <Search className="size-4" />
          </Button>
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          {me ? (
            <>
              <NotificationsBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="Account menu"
                    className="inline-flex size-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:size-9"
                  >
                    <Avatar className="size-8">
                      {me.avatar && <AvatarImage src={me.avatar} alt="" />}
                      <AvatarFallback className="text-xs">
                        {me.name.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <span className="block truncate text-sm font-medium">{me.name}</span>
                    {me.handle && (
                      <span className="block truncate text-xs text-muted-foreground">@{me.handle}</span>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {account.map((a) => (
                    <DropdownMenuItem key={a.href} asChild>
                      <Link prefetch={false} href={a.href}>{a.label}</Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={signOut}>Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button asChild size="sm" variant="ghost">
                <Link prefetch={false} href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link prefetch={false} href="/signup">Get started</Link>
              </Button>
            </div>
          )}
          <Button
            size="icon"
            variant="ghost"
            aria-label="Open menu"
            className="size-11 lg:hidden"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
        </div>
      </div>

      {searchUsed && <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />}

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="flex w-80 max-w-[85vw] flex-col gap-0 p-0">
          <div className="hairline-b flex h-16 shrink-0 items-center px-6">
            <SheetTitle asChild>
              <Link prefetch={false} href="/" onClick={close} aria-label="Nib home" className="flex items-center gap-1.5">
                <NibLogo />
              </Link>
            </SheetTitle>
          </div>
          <SheetDescription className="sr-only">Browse Nib pages</SheetDescription>
          <nav aria-label="Mobile" className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
            {NAV.map((l) => (
              <Link prefetch={false}
                key={l.href}
                href={l.href}
                onClick={close}
                aria-current={isActive(path, l.href) ? "page" : undefined}
                className="rounded-md px-3 py-3 text-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
              >
                {l.label}
              </Link>
            ))}
            {me && (
              <div className="hairline-t mt-3 flex flex-col pt-3">
                {[{ href: "/notifications", label: "Notifications" }, ...account].map((a) => (
                  <Link prefetch={false}
                    key={a.href}
                    href={a.href}
                    onClick={close}
                    aria-current={isActive(path, a.href) ? "page" : undefined}
                    className="rounded-md px-3 py-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-[current=page]:text-foreground"
                  >
                    {a.label}
                  </Link>
                ))}
              </div>
            )}
          </nav>
          <div className="hairline-t flex shrink-0 flex-col gap-3 p-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              Theme <ThemeToggle />
            </div>
            {me ? (
              <Button variant="outline" onClick={() => { close(); signOut() }}>
                Sign out
              </Button>
            ) : (
              <>
                <Button asChild>
                  <Link prefetch={false} href="/signup" onClick={close}>Get started</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link prefetch={false} href="/login" onClick={close}>Sign in</Link>
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}

const FOOTER = [
  {
    title: "Read",
    links: [
      { href: "/feed", label: "Feed" },
      { href: "/collections", label: "Collections" },
      { href: "/search", label: "Search" },
      { href: "/leaderboard", label: "Leaderboard" },
    ],
  },
  {
    title: "Write",
    links: [
      { href: "/studio", label: "Start writing" },
      { href: "/product", label: "How it works" },
      { href: "/earn", label: "Earning guide" },
      { href: "/pricing", label: "Pricing" },
      { href: "/docs", label: "Docs" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/feed.xml", label: "RSS" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/dmca", label: "Copyright" },
    ],
  },
]

export function SiteFooter() {
  const year = new Date().getFullYear()
  // One env var per account; an icon renders only when its URL is set.
  const social = [
    { href: process.env.NEXT_PUBLIC_SOCIAL_X, label: "X", Icon: TwitterIcon },
    { href: process.env.NEXT_PUBLIC_SOCIAL_GITHUB, label: "GitHub", Icon: GithubIcon },
    { href: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN, label: "LinkedIn", Icon: LinkedinIcon },
    { href: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM, label: "Instagram", Icon: InstagramIcon },
    { href: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE, label: "YouTube", Icon: YoutubeIcon },
  ].filter((s): s is typeof s & { href: string } => !!s.href)

  return (
    <footer className="hairline-t mt-16">
      <div className="container-wide py-12">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="space-y-4 md:col-span-4">
            <Link prefetch={false} href="/" aria-label="Nib home" className="group -my-2 flex items-center gap-1.5 py-3">
              <NibLogo />
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">
              Writing that adapts to its reader. Free to write, no ads.
            </p>
            {social.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {social.map(({ href, label, Icon }) => (
                  <Link prefetch={false}
                    key={label}
                    href={href}
                    aria-label={label}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel={href.startsWith("http") ? "noreferrer noopener" : undefined}
                    className="inline-flex size-11 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground lg:size-9"
                  >
                    <Icon className="size-4" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 md:col-span-8">
            {FOOTER.map((col) => (
              <div key={col.title}>
                <p className="mb-2 text-sm font-medium text-foreground">{col.title}</p>
                <ul className="text-sm text-muted-foreground">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link prefetch={false} href={l.href} className="inline-block py-2 hover:text-foreground lg:py-1">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <p className="hairline-t mt-10 pt-6 text-xs text-muted-foreground">© {year} Nib</p>
      </div>
      <ScrollToTop />
    </footer>
  )
}

function ScrollToTop() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 1.5)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  return (
    <Button
      size="icon"
      variant="outline"
      aria-label="Back to top"
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })
      }}
      className={`fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 size-11 rounded-full bg-background/90 shadow-sm backdrop-blur transition-opacity ${show ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <ArrowUp className="size-4" />
    </Button>
  )
}

"use client"

import { byokProviders } from "@/lib/ai-providers"
import Image from "next/image"
import Link from "next/link"
import { AccentPicker } from "@/components/accent-picker"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Camera, Lock, ShieldCheck } from "lucide-react"
import {
  getMyProfile,
  updateMyProfile,
  deleteMyAccount,
  getMyRole,
  toggleAuthorMode,
  listMyPieces,
} from "@/actions/content"
import { checkHandle, getEmailPrefs, setEmailPrefs } from "@/actions/settings"
import { supabase } from "@/lib/supabase/client"
import { initials } from "@/lib/handle"
import { MODES, MODE_HINT } from "@/lib/content/reader/data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { toast } from "sonner"
import { WaitlistButton } from "@/components/waitlist-button"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { PasswordInput } from "@/components/auth/password-input"
import { AvatarDialog } from "@/components/settings/avatar-dialog"
import { useMyPlan } from "@/hooks/use-my-plan"
import { hasStudioAccess } from "@/lib/plan"
import { AccessibilitySettings } from "@/components/accessibility-settings"
import { cn } from "@/lib/utils"

const DEFAULT_MODELS: Record<string, string[]> = {
  mistral: ["mistral-large-latest", "mistral-small-latest"],
  openai: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo", "o1-preview", "o1-mini"],
  anthropic: [
    "claude-3-5-sonnet-20240620",
    "claude-3-opus-20240229",
    "claude-3-haiku-20240307",
  ],
  google: ["gemini-1.5-pro", "gemini-1.5-flash"],
  openrouter: [
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
    "meta-llama/llama-3-70b-instruct",
  ],
  ollama: ["llama3", "mistral", "gemma", "phi3"],
  nvidia: ["meta/llama3-70b-instruct", "mistralai/mistral-large"],
}

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "account", label: "Account and sign-in" },
  { id: "notifications", label: "Notifications" },
  { id: "reading", label: "Reading and display" },
  { id: "writing", label: "Writing and AI" },
  { id: "plan", label: "Plan and payouts" },
  { id: "data", label: "Privacy and data" },
  { id: "accessibility", label: "Accessibility" },
  { id: "delete", label: "Delete account" },
] as const
type SectionId = (typeof SECTIONS)[number]["id"]

const BIO_MAX = 500

// One settings row: label + help on the left, control on the right.
function Row({
  title,
  help,
  htmlFor,
  children,
}: {
  title: string
  help?: React.ReactNode
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <Label htmlFor={htmlFor} className="text-base">{title}</Label>
        {help && <p className="mt-1 text-sm text-muted-foreground">{help}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby="settings-title">
      <h2 id="settings-title" className="font-display text-2xl text-foreground">{title}</h2>
      {intro && <p className="mt-1 text-sm text-muted-foreground">{intro}</p>}
      <div className="mt-4 divide-y divide-border border-y border-border">{children}</div>
    </section>
  )
}

export default function SettingsPage() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
  const [section, setSection] = useState<SectionId>("profile")
  // Deep links: /studio/settings#account
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1)
      if (SECTIONS.some((s) => s.id === h)) setSection(h as SectionId)
    }
    read()
    window.addEventListener("hashchange", read)
    return () => window.removeEventListener("hashchange", read)
  }, [])
  const go = (id: SectionId) => {
    setSection(id)
    history.replaceState(null, "", `#${id}`)
  }

  if (!mounted) return null

  return (
    <div className="mx-auto w-full max-w-350 px-4 py-6 md:p-8">
      <h1 className="font-display text-3xl text-foreground">Settings</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections">
          {/* Phones: one menu. Desktop: the full list. */}
          <div className="lg:hidden">
            <Label htmlFor="settings-section" className="sr-only">Section</Label>
            <Select value={section} onValueChange={(v) => go(v as SectionId)}>
              <SelectTrigger id="settings-section" className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECTIONS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ul className="sticky top-20 hidden space-y-1 lg:block">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => go(s.id)}
                  aria-current={section === s.id ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm transition-colors",
                    section === s.id
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    s.id === "delete" && section !== s.id && "text-destructive/80 hover:text-destructive"
                  )}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 max-w-3xl">
          {section === "profile" && <ProfileSection />}
          {section === "account" && <AccountSection />}
          {section === "notifications" && <NotificationsSection />}
          {section === "reading" && <ReadingSection />}
          {section === "writing" && <WritingSection />}
          {section === "plan" && <PlanSection />}
          {section === "data" && <DataSection />}
          {section === "accessibility" && (
            <Section title="Accessibility">
              <div className="py-5"><AccessibilitySettings /></div>
            </Section>
          )}
          {section === "delete" && <DeleteSection />}
        </div>
      </div>
    </div>
  )
}

function useProfile() {
  return useQuery({ queryKey: ["my-profile"], queryFn: () => getMyProfile() })
}

// ---------------- Profile ----------------
type ProfileForm = { displayName: string; handle: string; bio: string; website: string; links: string; pinned: string }

function ProfileSection() {
  const q = useProfile()
  const piecesQ = useQuery({ queryKey: ["my-pieces"], queryFn: () => listMyPieces() })
  const published = (piecesQ.data ?? []).filter((p: { status: string }) => p.status === "published")
  const fromServer = useCallback(
    (): ProfileForm => ({
      displayName: q.data?.display_name ?? "",
      handle: q.data?.handle ?? "",
      bio: q.data?.bio ?? "",
      website: q.data?.website ?? "",
      links: (q.data?.links ?? []).join("\n"),
      pinned: q.data?.pinned_piece_id ?? "none",
    }),
    [q.data]
  )
  const [form, setForm] = useState<ProfileForm>(fromServer)
  const [base, setBase] = useState<ProfileForm>(fromServer)
  useEffect(() => {
    if (!q.data) return
    requestAnimationFrame(() => {
      const fresh = fromServer()
      // A refetch (e.g. after a photo change) keeps any unsaved edits.
      setBase((old) => {
        setForm((f) => (JSON.stringify(f) === JSON.stringify(old) ? fresh : f))
        return fresh
      })
    })
  }, [q.data, fromServer])
  const set = (k: keyof ProfileForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }))
  const dirty = JSON.stringify(form) !== JSON.stringify(base)

  // Live handle check, debounced.
  const [handleState, setHandleState] = useState<{ ok: boolean; reason?: string } | null>(null)
  useEffect(() => {
    if (form.handle === base.handle) return void requestAnimationFrame(() => setHandleState(null))
    const t = setTimeout(() => checkHandle(form.handle).then(setHandleState).catch(() => {}), 350)
    return () => clearTimeout(t)
  }, [form.handle, base.handle])

  const [saving, setSaving] = useState(false)
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateMyProfile({
        data: {
          display_name: form.displayName,
          handle: form.handle,
          bio: form.bio || null,
          website: form.website || null,
          links: form.links.split("\n"),
          pinned_piece_id: form.pinned === "none" ? null : form.pinned,
        },
      })
      toast.success("Profile saved")
      await q.refetch()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const avatar: string = q.data?.avatar_url ?? ""
  const [photoOpen, setPhotoOpen] = useState(false)
  const setAvatar = async (url: string | null) => {
    await updateMyProfile({ data: { avatar_url: url } })
    await q.refetch()
  }
  const uploadAvatar = async (blob: Blob) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Sign in first.")
    const path = `${user.id}/avatar-${Date.now()}.jpg`
    const { error } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg" })
    if (error) throw error
    await setAvatar(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl)
    toast.success("Photo updated")
  }

  const handleId = "set-handle-status"
  return (
    <form onSubmit={save}>
      <Section title="Profile" intro="How you appear to readers on your profile and pieces.">
        <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setPhotoOpen(true)}
            className="group relative size-20 shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="Change profile photo"
          >
            <Avatar className="size-20">
              {avatar && <AvatarImage src={avatar} alt="" />}
              <AvatarFallback className="text-xl">{initials(form.displayName || form.handle)}</AvatarFallback>
            </Avatar>
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <Camera className="size-5" aria-hidden />
            </span>
          </button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setPhotoOpen(true)}>
              {avatar ? "Change photo" : "Add photo"}
            </Button>
            {avatar && (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                onClick={() => setAvatar(null).then(() => toast.success("Photo removed"), (e) => toast.error(e.message))}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
        <AvatarDialog
          open={photoOpen}
          onOpenChange={setPhotoOpen}
          onSave={uploadAvatar}
          onUseUrl={async (url) => {
            await setAvatar(url)
            toast.success("Photo updated")
          }}
        />

        <div className="grid gap-5 py-5 sm:grid-cols-2">
          <div className="min-w-0">
            <Label htmlFor="set-name">Display name</Label>
            <Input id="set-name" className="mt-2 min-h-11" value={form.displayName} onChange={(e) => set("displayName")(e.target.value)} required maxLength={60} />
          </div>
          <div className="min-w-0">
            <Label htmlFor="set-handle">Handle</Label>
            <Input
              id="set-handle"
              className="mt-2 min-h-11"
              value={form.handle}
              onChange={(e) => set("handle")(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              required
              maxLength={30}
              aria-invalid={handleState?.ok === false || undefined}
              aria-describedby={handleId}
            />
            <p id={handleId} aria-live="polite" className={cn("mt-1 text-sm", handleState?.ok === false ? "text-destructive" : "text-muted-foreground")}>
              {handleState?.ok === false
                ? handleState.reason
                : handleState?.ok
                  ? `Available · /u/${form.handle}`
                  : `Your profile: /u/${form.handle || "…"}`}
            </p>
          </div>
        </div>

        <div className="py-5">
          <Label htmlFor="set-bio">Bio</Label>
          <Textarea id="set-bio" className="mt-2" rows={3} value={form.bio} onChange={(e) => set("bio")(e.target.value)} maxLength={BIO_MAX} aria-describedby="set-bio-count" />
          <p id="set-bio-count" className="mt-1 text-sm text-muted-foreground tabular-nums">{form.bio.length} / {BIO_MAX}</p>
        </div>

        <div className="grid gap-5 py-5 sm:grid-cols-2">
          <div className="min-w-0">
            <Label htmlFor="set-website">Website</Label>
            <Input
              id="set-website"
              className="mt-2 min-h-11"
              // Text, not type="url": "yoursite.com" is fine; the server adds https:// and checks it.
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="yoursite.com"
              value={form.website}
              onChange={(e) => set("website")(e.target.value)}
            />
          </div>
          <div className="min-w-0">
            <Label htmlFor="set-pinned">Pinned piece</Label>
            <Select value={form.pinned} onValueChange={set("pinned")}>
              <SelectTrigger id="set-pinned" className="mt-2 min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {published.map((p: { id: string; title: string }) => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-sm text-muted-foreground">Shown first on your profile.</p>
          </div>
        </div>

        <div className="py-5">
          <Label htmlFor="set-links">Other links</Label>
          <Textarea id="set-links" className="mt-2" rows={3} placeholder={"x.com/you\nlinkedin.com/in/you"} value={form.links} onChange={(e) => set("links")(e.target.value)} />
          <p className="mt-1 text-sm text-muted-foreground">One per line, up to 5. Shown on your profile.</p>
        </div>

        <div className="py-5">
          <Label htmlFor="set-dob">Date of birth</Label>
          <Input id="set-dob" className="mt-2 min-h-11 sm:max-w-xs" value={q.data?.date_of_birth || "Not provided"} disabled />
          <p className="mt-1 text-sm text-muted-foreground">
            Not shown to anyone. To correct it, <Link href="/contact" className="underline underline-offset-2">contact support</Link>.
          </p>
        </div>
      </Section>

      {dirty && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-md md:border">
          <p className="text-sm text-muted-foreground">Unsaved changes</p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => setForm(base)} disabled={saving}>Discard</Button>
            <Button type="submit" className="min-h-11" disabled={saving || handleState?.ok === false}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </form>
  )
}

// ---------------- Account and sign-in ----------------
function AccountSection() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""))
  }, [])

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const changeEmail = () =>
    run("email", async () => {
      const next = newEmail.trim()
      if (!next || next.toLowerCase() === email.toLowerCase()) throw new Error("Enter a different email.")
      const { error } = await supabase.auth.updateUser(
        { email: next },
        { emailRedirectTo: `${window.location.origin}/studio/settings#account` }
      )
      if (error) throw error
      setNewEmail("")
      toast.success(`Check ${next} to confirm the change.`)
    })

  const changePassword = () =>
    run("password", async () => {
      if (password.length < 8) throw new Error("Use at least 8 characters.")
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setPassword("")
      toast.success("Password changed")
    })

  const signOutOthers = () =>
    run("others", async () => {
      const { error } = await supabase.auth.signOut({ scope: "others" })
      if (error) throw error
      toast.success("Signed out of your other devices")
    })

  const signOutAll = () =>
    run("all", async () => {
      const { error } = await supabase.auth.signOut({ scope: "global" })
      if (error) throw error
      router.push("/login")
    })

  return (
    <Section title="Account and sign-in">
      <div className="py-5">
        <Label htmlFor="set-email" className="text-base">Email</Label>
        <p className="mt-1 text-sm text-muted-foreground">Currently <span className="text-foreground">{email || "…"}</span>. We&apos;ll send a link to the new address to confirm.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input id="set-email" type="email" autoComplete="email" className="min-h-11" placeholder="new@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <Button type="button" variant="outline" className="min-h-11" onClick={changeEmail} disabled={busy === "email" || !newEmail.trim()}>
            {busy === "email" ? "Sending…" : "Change email"}
          </Button>
        </div>
      </div>

      <div className="py-5">
        <Label htmlFor="set-password" className="text-base">Password</Label>
        <p className="mt-1 text-sm text-muted-foreground">Set a new password. Signed in with a magic link? This adds one.</p>
        <div className="mt-3 space-y-2 sm:max-w-sm">
          <PasswordInput id="set-password" value={password} onChange={setPassword} isNew />
          <Button type="button" variant="outline" className="min-h-11" onClick={changePassword} disabled={busy === "password" || !password}>
            {busy === "password" ? "Saving…" : "Change password"}
          </Button>
        </div>
      </div>

      <TwoFactorRow />

      <Row title="Other devices" help="Signs out every browser and phone except this one.">
        <Button type="button" variant="outline" className="min-h-11" onClick={signOutOthers} disabled={busy === "others"}>
          Sign out other devices
        </Button>
      </Row>
      <Row title="Everywhere" help="Signs out all devices, including this one.">
        <Button type="button" variant="ghost" className="min-h-11" onClick={signOutAll} disabled={busy === "all"}>
          Sign out everywhere
        </Button>
      </Row>
    </Section>
  )
}

function TwoFactorRow() {
  const [status, setStatus] = useState<{ enabled: boolean; factorId: string | null } | null>(null)
  const [qr, setQr] = useState<{ qr: string; secret: string; factorId: string } | null>(null)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)

  const check = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) return setStatus({ enabled: false, factorId: null })
    const f = data.totp.find((x) => (x.status as string) === "verified")
    setStatus({ enabled: !!f, factorId: f?.id ?? null })
  }, [])
  useEffect(() => {
    requestAnimationFrame(() => void check())
  }, [check])

  const start = async () => {
    setBusy(true)
    try {
      const { data: list, error: listError } = await supabase.auth.mfa.listFactors()
      if (listError) throw listError
      // Clear half-finished set-ups so enrolling doesn't fail with "factor already exists".
      for (const f of list.totp.filter((x) => (x.status as string) === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" })
      if (error) throw error
      setQr({ qr: data.totp.qr_code, secret: data.totp.secret, factorId: data.id })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    if (!qr) return
    setBusy(true)
    try {
      const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId: qr.factorId })
      if (cErr) throw cErr
      const { error } = await supabase.auth.mfa.verify({ factorId: qr.factorId, challengeId: ch.id, code })
      if (error) throw error
      toast.success("Two-factor sign-in is on")
      setQr(null)
      setCode("")
      await check()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    if (!status?.factorId) return
    const { error } = await supabase.auth.mfa.unenroll({ factorId: status.factorId })
    if (error) return void toast.error(error.message)
    toast.success("Two-factor sign-in is off")
    await check()
  }

  if (qr)
    return (
      <div className="space-y-3 py-5">
        <p className="flex items-center gap-2 text-base font-medium"><ShieldCheck className="size-4" aria-hidden /> Two-factor sign-in</p>
        <p className="text-sm text-muted-foreground">Scan this code with your authenticator app, then enter the 6-digit code it shows.</p>
        <Image src={qr.qr} alt="Authenticator QR code" width={176} height={176} unoptimized className="size-44 rounded bg-white p-2" />
        <p className="font-mono text-sm break-all text-muted-foreground">Can&apos;t scan? Enter this key: {qr.secret}</p>
        <div className="flex flex-wrap gap-2">
          <Input aria-label="6-digit code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" maxLength={6} className="min-h-11 w-32" />
          <Button type="button" className="min-h-11" onClick={verify} disabled={busy || code.length !== 6}>Turn on</Button>
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => (setQr(null), setCode(""))}>Cancel</Button>
        </div>
      </div>
    )

  return (
    <Row
      title="Two-factor sign-in"
      help={
        status === null
          ? "Checking…"
          : status.enabled
            ? "On. You'll enter a code from your authenticator app when you sign in."
            : "Ask for a code from an authenticator app (1Password, Authy, Google Authenticator) when you sign in."
      }
    >
      {status?.enabled ? (
        <ConfirmDialog
          trigger={<Button type="button" variant="outline" className="min-h-11">Turn off</Button>}
          title="Turn off two-factor sign-in?"
          description="Your account will only need your password or email link to sign in. You'll scan a new code if you turn it on again."
          destructive
          confirmLabel="Turn off"
          onConfirm={disable}
        />
      ) : (
        <Button type="button" variant="outline" className="min-h-11" onClick={start} disabled={busy || status === null}>
          {busy ? "Preparing…" : "Turn on"}
        </Button>
      )}
    </Row>
  )
}

// ---------------- Notifications ----------------
function NotificationsSection() {
  const q = useQuery({ queryKey: ["email-prefs"], queryFn: () => getEmailPrefs() })
  const [saving, setSaving] = useState(false)
  const toggle = async (on: boolean) => {
    setSaving(true)
    try {
      await setEmailPrefs({ newPieces: on })
      await q.refetch()
      toast.success(on ? "Emails on" : "Emails off")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <Section title="Notifications" intro="In-app notifications always appear under the bell. These control email.">
      <Row
        title="Emails from Nib"
        htmlFor="set-email-pieces"
        help="New pieces from writers you follow, and a confirmation when you follow someone. Each email also has a link to stop emails from that writer."
      >
        <Switch id="set-email-pieces" checked={q.data?.newPieces ?? true} onCheckedChange={toggle} disabled={!q.data || saving} />
      </Row>
      <p className="py-5 text-sm text-muted-foreground">
        Account emails (sign-in links, password resets, receipts) are always sent.
      </p>
    </Section>
  )
}

// ---------------- Reading and display ----------------
function ReadingSection() {
  const q = useProfile()
  const { theme, setTheme } = useTheme()
  const [mode, setMode] = useState("standard")
  useEffect(() => {
    try {
      const m = localStorage.getItem("reader:mode")
      if (m) requestAnimationFrame(() => setMode(m))
    } catch {}
  }, [])
  const [nsfw, setNsfw] = useState<boolean | null>(null)
  const nsfwOn = nsfw ?? q.data?.nsfw_enabled ?? false

  return (
    <Section title="Reading and display">
      <Row title="Theme" help="System follows your device.">
        <ToggleGroup type="single" variant="outline" value={theme ?? "system"} onValueChange={(v) => v && setTheme(v)} aria-label="Theme">
          <ToggleGroupItem value="light" className="min-h-11 px-4">Light</ToggleGroupItem>
          <ToggleGroupItem value="dark" className="min-h-11 px-4">Dark</ToggleGroupItem>
          <ToggleGroupItem value="system" className="min-h-11 px-4">System</ToggleGroupItem>
        </ToggleGroup>
      </Row>
      <Row title="Default reading mode" htmlFor="set-mode" help="Pieces open in this mode when the writer offers it. You can switch while reading.">
        <Select
          value={mode}
          onValueChange={(m) => {
            setMode(m)
            try {
              localStorage.setItem("reader:mode", m)
            } catch {}
            toast.success("Saved on this device")
          }}
        >
          <SelectTrigger id="set-mode" className="min-h-11 w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODES.map((m) => (
              <SelectItem key={m} value={m}>
                <span className="capitalize">{m}</span>
                <span className="ml-2 text-muted-foreground">{MODE_HINT[m]}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      <div className="py-5">
        <p className="text-base font-medium">Accent colour</p>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">Used for links, buttons and highlights.</p>
        <AccentPicker />
      </div>
      <Row
        title="Show mature content"
        htmlFor="set-nsfw"
        help="Show pieces marked mature (NSFW) in your feeds. Turning this on confirms you're 18 or older."
      >
        <Switch
          id="set-nsfw"
          checked={nsfwOn}
          disabled={!q.data}
          onCheckedChange={async (v) => {
            setNsfw(v)
            try {
              await updateMyProfile({ data: { nsfw_enabled: v } })
              await q.refetch()
              toast.success("Saved")
            } catch (e) {
              setNsfw(!v)
              toast.error((e as Error).message)
            }
          }}
        />
      </Row>
    </Section>
  )
}

// ---------------- Writing and AI ----------------
function WritingSection() {
  const q = useProfile()
  const roleQ = useQuery({ queryKey: ["my-role"], queryFn: () => getMyRole() })
  const isCreator = roleQ.data?.primary === "creator" || roleQ.data?.primary === "admin"
  const [toggling, setToggling] = useState(false)

  const [provider, setProvider] = useState("mistral")
  const [model, setModel] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [keySet, setKeySet] = useState(false)
  const [custom, setCustom] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!q.data) return
    requestAnimationFrame(() => {
      const p = q.data.byok_provider ?? "mistral"
      const m = q.data.byok_model ?? ""
      setProvider(p)
      setModel(m)
      // The raw key never reaches the client; we only learn whether one is set.
      setApiKey("")
      setKeySet(q.data.byok_api_key_set ?? false)
      setCustom(!!m && !(DEFAULT_MODELS[p] || []).includes(m))
    })
  }, [q.data])

  const toggleAuthor = async () => {
    setToggling(true)
    try {
      await toggleAuthorMode({ data: { enabled: !isCreator } })
      toast.success(isCreator ? "Author mode off" : "Author mode on")
      roleQ.refetch()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setToggling(false)
    }
  }

  const saveAi = async () => {
    setSaving(true)
    try {
      await updateMyProfile({
        data: {
          byok_provider: provider,
          byok_model: model || null,
          // Only send a newly typed key; a blank field keeps the stored one.
          ...(apiKey.trim() ? { byok_api_key: apiKey.trim() } : {}),
        },
      })
      toast.success("AI settings saved")
      setApiKey("") // never keep the plaintext key in the DOM after save
      q.refetch()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const clearKey = async () => {
    try {
      await updateMyProfile({ data: { byok_api_key: "" } })
      setKeySet(false)
      setApiKey("")
      toast.success("API key removed")
      q.refetch()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <Section title="Writing and AI">
      <Row title="Author mode" htmlFor="set-author" help="Write and publish pieces, manage branches, set up tiers and receive tips and sales.">
        <Switch id="set-author" checked={isCreator} onCheckedChange={toggleAuthor} disabled={toggling || !roleQ.data} />
      </Row>
      {isCreator && (
        <div className="space-y-4 py-5">
          <div>
            <p className="text-base font-medium">Your own AI key</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use your own provider key to skip Nib&apos;s free AI limits. Keys are encrypted and never shown again.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <Label htmlFor="set-byok-provider">Provider</Label>
              <Select
                value={provider}
                onValueChange={(v) => {
                  setProvider(v)
                  setModel("")
                  setCustom(false)
                }}
              >
                <SelectTrigger id="set-byok-provider" className="mt-2 min-h-11 w-full">
                  <SelectValue placeholder="Choose a provider" />
                </SelectTrigger>
                <SelectContent>
                  {byokProviders().map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label htmlFor="set-byok-model">Model</Label>
              {!custom ? (
                <Select
                  value={model || "default"}
                  onValueChange={(v) => {
                    if (v === "custom") {
                      setCustom(true)
                      setModel("")
                    } else setModel(v === "default" ? "" : v)
                  }}
                >
                  <SelectTrigger id="set-byok-model" className="mt-2 min-h-11 w-full">
                    <SelectValue placeholder="Choose a model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    {(DEFAULT_MODELS[provider] || []).map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                    <SelectItem value="custom">Other model…</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-2 flex gap-2">
                  <Input id="set-byok-model" className="min-h-11 flex-1" value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. gpt-4o" />
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => (setCustom(false), setModel(""))}>Cancel</Button>
                </div>
              )}
            </div>
            <div className="min-w-0 sm:col-span-2">
              <Label htmlFor="set-byok-key">API key</Label>
              <Input
                id="set-byok-key"
                type="password"
                autoComplete="off"
                className="mt-2 min-h-11"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider === "ollama" ? "Not needed" : keySet ? "Saved. Enter a new key to replace it." : "sk-…"}
                disabled={provider === "ollama"}
              />
              {keySet && !apiKey.trim() && provider !== "ollama" && (
                <button type="button" onClick={clearKey} className="mt-1 min-h-11 text-sm text-muted-foreground underline underline-offset-2 hover:text-destructive">
                  Remove saved key
                </button>
              )}
            </div>
          </div>
          <Button type="button" className="min-h-11" onClick={saveAi} disabled={saving}>
            {saving ? "Saving…" : "Save AI settings"}
          </Button>
        </div>
      )}
    </Section>
  )
}

// ---------------- Plan and payouts ----------------
function PlanSection() {
  const { plan, launchFree } = useMyPlan()
  return (
    <Section title="Plan and payouts">
      <div className="space-y-3 py-5">
        {launchFree ? (
          <>
            <p className="text-base font-medium">Free launch: every feature is unlocked</p>
            <p className="text-sm text-muted-foreground">Paid plans are on hold while we launch. Join the waitlist to hear when they open.</p>
            <WaitlistButton item="studio" source="settings" signedIn />
          </>
        ) : (
          <p className="text-base font-medium">
            Current plan: <span className="capitalize">{plan === "reader" ? "Reader Pass" : plan}</span>
          </p>
        )}
      </div>
      <Row title="Earnings and payouts" help="Your balance, payout details and history.">
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/me/earnings">Open earnings</Link>
        </Button>
      </Row>
    </Section>
  )
}

// ---------------- Privacy and data ----------------
function ProfileSwitch({ field, title, help }: { field: "show_claps" | "hide_from_leaderboard"; title: string; help: string }) {
  const q = useProfile()
  const [local, setLocal] = useState<boolean | null>(null)
  const on = local ?? Boolean((q.data as Record<string, unknown> | null | undefined)?.[field])
  const id = `set-${field}`
  return (
    <Row title={title} htmlFor={id} help={help}>
      <Switch
        id={id}
        checked={on}
        disabled={!q.data}
        onCheckedChange={async (v) => {
          setLocal(v)
          try {
            await updateMyProfile({ data: { [field]: v } })
            await q.refetch()
            toast.success("Saved")
          } catch (e) {
            setLocal(!v)
            toast.error((e as Error).message)
          }
        }}
      />
    </Row>
  )
}

function DataSection() {
  const { plan } = useMyPlan()
  const hasStudio = hasStudioAccess(plan)
  const roleQ = useQuery({ queryKey: ["my-role"], queryFn: () => getMyRole() })
  const isCreator = roleQ.data?.primary === "creator" || roleQ.data?.primary === "admin"
  const studioTag = !hasStudio && (
    <span className="ml-2 inline-flex items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
      <Lock className="size-3" aria-hidden /> Studio
    </span>
  )
  return (
    <Section title="Privacy and data">
      <ProfileSwitch
        field="show_claps"
        title="Show pieces I clapped"
        help="Adds a Clapped tab to your public profile."
      />
      <ProfileSwitch
        field="hide_from_leaderboard"
        title="Hide me from the readers leaderboard"
        help="You still earn points; you just aren't listed."
      />
      <Row title="Saved pieces" help="Your saved list is private. Only collections you make public appear on your profile.">
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/studio/collections">Manage collections</Link>
        </Button>
      </Row>
      <Row title="Download your data" help={<>Your profile, pieces, blocks and branches as a JSON file.{studioTag}</>}>
        <Button type="button" variant="outline" className="min-h-11" disabled={!hasStudio} onClick={() => window.open("/api/export", "_blank")}>
          Download
        </Button>
      </Row>
      {isCreator && (
        <Row title="Export subscribers" help={<>Your audience as a CSV file. You own this list.{studioTag}</>}>
          <Button type="button" variant="outline" className="min-h-11" disabled={!hasStudio} onClick={() => window.open("/api/export/subscribers", "_blank")}>
            Export CSV
          </Button>
        </Row>
      )}
    </Section>
  )
}

// ---------------- Delete account ----------------
function DeleteSection() {
  const router = useRouter()
  const deleteAccount = async () => {
    try {
      await deleteMyAccount()
      await supabase.auth.signOut()
      toast.success("Account deleted")
      router.push("/")
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  return (
    <section aria-labelledby="settings-title">
      <h2 id="settings-title" className="font-display text-2xl text-destructive">Delete account</h2>
      <div className="mt-4 space-y-4 rounded-md border border-destructive/40 p-5">
        <p className="text-sm text-muted-foreground">
          Permanently deletes your profile, pieces, branches, bundles and tiers. Purchases and supporters&apos; records are kept in archived form.
        </p>
        <ConfirmDialog
          trigger={<Button variant="destructive" className="min-h-11">Delete my account</Button>}
          title="Delete your account?"
          description="This is permanent and can't be undone."
          destructive
          typedConfirm="delete my account"
          confirmLabel="Delete forever"
          onConfirm={deleteAccount}
        />
      </div>
    </section>
  )
}

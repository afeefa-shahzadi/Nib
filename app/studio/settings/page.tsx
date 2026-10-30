"use client"

import { byokProviders } from "@/lib/ai-providers"
import Image from "next/image"
import { AccentPicker } from "@/components/accent-picker"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { ShieldCheck } from "lucide-react"

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
import {
  getMyProfile,
  updateMyProfile,
  deleteMyAccount,
  getMyRole,
  toggleAuthorMode,
  listMyPieces,
} from "@/actions/content"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { toast } from "sonner"
import { WaitlistButton } from "@/components/waitlist-button"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Upload, Lock } from "lucide-react"
import { useMyPlan } from "@/hooks/use-my-plan"
import { hasStudioAccess } from "@/lib/plan"
import { AccessibilitySettings } from "@/components/accessibility-settings"

export default function SettingsPage() {
  const router = useRouter()
  const getFn = getMyProfile
  const updFn = updateMyProfile
  const delFn = deleteMyAccount
  const getRoleFn = getMyRole
  const toggleRoleFn = toggleAuthorMode
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
  const q = useQuery({ queryKey: ["my-profile"], queryFn: () => getFn() })
  const roleQ = useQuery({ queryKey: ["my-role"], queryFn: () => getRoleFn() })

  const { plan, launchFree } = useMyPlan()
  const hasStudio = hasStudioAccess(plan)

  const [displayName, setDisplayName] = useState("")
  const [handle, setHandle] = useState("")
  const [bio, setBio] = useState("")
  const [website, setWebsite] = useState("")
  const [links, setLinks] = useState("")
  const [pinned, setPinned] = useState("none")
  const piecesQ = useQuery({ queryKey: ["my-pieces"], queryFn: () => listMyPieces() })
  const published = (piecesQ.data ?? []).filter((p: { status: string }) => p.status === "published")
  const [avatar, setAvatar] = useState("")
  const [byokProvider, setByokProvider] = useState("mistral")
  const [byokModel, setByokModel] = useState("")
  const [byokApiKey, setByokApiKey] = useState("")
  const [byokKeySet, setByokKeySet] = useState(false)
  const [nsfwEnabled, setNsfwEnabled] = useState(false)
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [enrollingMfa, setEnrollingMfa] = useState(false)
  const [mfaQr, setMfaQr] = useState<{
    qr: string
    secret: string
    factorId: string
  } | null>(null)
  const [mfaCode, setMfaCode] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const [toggling, setToggling] = useState(false)
  const [isCustomModel, setIsCustomModel] = useState(false)
  const isCreator =
    roleQ.data?.primary === "creator" || roleQ.data?.primary === "admin"

  const [mfaStatus, setMfaStatus] = useState<{
    enabled: boolean
    factorId: string | null
  }>({ enabled: false, factorId: null })
  const [checkingMfa, setCheckingMfa] = useState(true)

  const checkMfa = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      const verifiedTotp = data.totp.find(
        (f) => (f.status as string) === "verified"
      )
      if (verifiedTotp) {
        setMfaStatus({ enabled: true, factorId: verifiedTotp.id })
      } else {
        setMfaStatus({ enabled: false, factorId: null })
      }
    } catch {
      // silent
    } finally {
      setCheckingMfa(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (!active) return
      if (error) {
        setCheckingMfa(false)
        return
      }
      const verifiedTotp = data?.totp?.find(
        (f) => (f.status as string) === "verified"
      )
      if (verifiedTotp) {
        setMfaStatus({ enabled: true, factorId: verifiedTotp.id })
      } else {
        setMfaStatus({ enabled: false, factorId: null })
      }
      setCheckingMfa(false)
    })
    return () => {
      active = false
    }
  }, [])

  const handleToggleAuthorMode = async () => {
    setToggling(true)
    try {
      await toggleRoleFn({ data: { enabled: !isCreator } })
      toast.success(isCreator ? "Author mode disabled" : "Author mode enabled")
      roleQ.refetch()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setToggling(false)
    }
  }

  useEffect(() => {
    if (!q.data) return
    requestAnimationFrame(() => {
      setDisplayName(q.data.display_name ?? "")
      setHandle(q.data.handle ?? "")
      setBio(q.data.bio ?? "")
      setWebsite(q.data.website ?? "")
      setLinks((q.data.links ?? []).join("\n"))
      setPinned(q.data.pinned_piece_id ?? "none")
      setAvatar(q.data.avatar_url ?? "")

      const provider = q.data.byok_provider ?? "mistral"
      const model = q.data.byok_model ?? ""
      setByokProvider(provider)
      setByokModel(model)
      // Raw key is never sent to the client; we only learn whether one is set.
      setByokApiKey("")
      setByokKeySet(q.data.byok_api_key_set ?? false)
      setNsfwEnabled(q.data.nsfw_enabled ?? false)
      setDateOfBirth(q.data.date_of_birth ?? "")

      if (model && !(DEFAULT_MODELS[provider] || []).includes(model)) {
        setIsCustomModel(true)
      } else {
        setIsCustomModel(false)
      }
    })
  }, [q.data])

  const save = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updFn({
        data: {
          display_name: displayName,
          handle: handle.toLowerCase().replace(/[^a-z0-9_]/g, ""),
          bio: bio || null,
          website: website || null,
          links: links.split("\n"),
          pinned_piece_id: pinned === "none" ? null : pinned,
          avatar_url: avatar || null,
          byok_provider: byokProvider,
          byok_model: byokModel || null,
          // Only send the key when the user typed a new one — a blank field
          // leaves the stored key untouched instead of wiping it.
          ...(byokApiKey.trim() ? { byok_api_key: byokApiKey.trim() } : {}),
          nsfw_enabled: nsfwEnabled,
        },
      })
      toast.success("Profile updated")
      setByokApiKey("") // never keep the plaintext key in the DOM after save
      q.refetch()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const clearByokKey = async () => {
    try {
      await updFn({ data: { byok_api_key: "" } })
      setByokKeySet(false)
      setByokApiKey("")
      toast.success("API key removed")
      q.refetch()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const deleteAccount = async () => {
    try {
      await delFn()
      await supabase.auth.signOut()
      toast.success("Account deleted")
      router.push("/")
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Avatar must be under 5MB")
      return
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      toast.error("Not signed in")
      return
    }
    setUploading(true)
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase()
      const path = `${user.id}/avatar-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path)
      setAvatar(pub.publicUrl)
      await updFn({ data: { avatar_url: pub.publicUrl } })
      toast.success("Avatar uploaded")
      q.refetch()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const startMfa = async () => {
    setEnrollingMfa(true)
    try {
      // List existing factors
      const { data: listData, error: listError } =
        await supabase.auth.mfa.listFactors()
      if (listError) throw listError

      // Unenroll any existing unverified factors to avoid "factor already exists" error
      const unverified = listData.totp.filter(
        (f) => (f.status as string) === "unverified"
      )
      for (const f of unverified) {
        await supabase.auth.mfa.unenroll({ factorId: f.id })
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      })
      if (error) throw error
      setMfaQr({
        qr: data.totp.qr_code,
        secret: data.totp.secret,
        factorId: data.id,
      })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setEnrollingMfa(false)
    }
  }

  const disableMfa = async () => {
    if (!mfaStatus.factorId) return
    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: mfaStatus.factorId,
      })
      if (error) throw error
      toast.success("Two-factor authentication disabled")
      await checkMfa()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const verifyMfa = async () => {
    if (!mfaQr) return
    try {
      const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({
        factorId: mfaQr.factorId,
      })
      if (cErr) throw cErr
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: mfaQr.factorId,
        challengeId: ch.id,
        code: mfaCode,
      })
      if (vErr) throw vErr
      toast.success("Two-factor authentication enabled")
      setMfaQr(null)
      setMfaCode("")
      await checkMfa()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (!mounted) return null

  return (
    <div className="mx-auto w-full max-w-350 p-6 md:p-8">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
        Settings
      </p>
      <h1 className="mb-6 font-display text-3xl text-foreground">Profile</h1>
      <form
        onSubmit={save}
        className="surface space-y-4 rounded-md border border-border/60 p-6"
      >
        <div className="flex items-start gap-4">
          <div className="size-16 shrink-0 overflow-hidden rounded-full bg-muted">
            <Image
              src={avatar || "/placeholder.jpeg"}
              alt={displayName || "Avatar"}
              width={64}
              height={64}
              className="size-full object-cover"
            />
          </div>
          <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
            <div className="min-w-0">
              <Label htmlFor="set-name">Display name</Label>
              <Input
                id="set-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="set-handle">Handle</Label>
              <Input
                id="set-handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Your public URL: /u/{handle || "…"}
              </p>
            </div>
            <div className="min-w-0 md:col-span-2">
              <Label htmlFor="set-dob">Date of Birth</Label>
              <Input
                id="set-dob"
                value={dateOfBirth || "Not provided"}
                disabled
                className="bg-muted/50 text-muted-foreground"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Cannot be edited. Contact support to change.
              </p>
            </div>
          </div>
        </div>
        <div>
          <Label htmlFor="set-bio">Bio</Label>
          <Textarea
            id="set-bio"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
          />
          <p className="mt-1 text-xs text-muted-foreground">{bio.length}/500</p>
        </div>
        <div>
          <Label htmlFor="set-website">Website</Label>
          <Input
            id="set-website"
            // Text, not type="url": "yoursite.com" is fine; the server adds https:// and checks it.
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="yoursite.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="set-links">Other links</Label>
          <Textarea
            id="set-links"
            rows={3}
            placeholder={"x.com/you\nlinkedin.com/in/you"}
            value={links}
            onChange={(e) => setLinks(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">One per line, up to 5. Shown on your profile.</p>
        </div>
        <div>
          <Label htmlFor="set-pinned">Pinned piece</Label>
          <Select value={pinned} onValueChange={setPinned}>
            <SelectTrigger id="set-pinned" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {published.map((p: { id: string; title: string }) => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">Shown first on your profile.</p>
        </div>
        <div>
          <Label htmlFor="set-avatar">Avatar</Label>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickAvatar}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="mr-2 size-4" />
              {uploading ? "Uploading…" : "Upload image"}
            </Button>
            <Input
              id="set-avatar"
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="…or paste URL"
            />
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div>
            <Label htmlFor="nsfw">Allow NSFW Content</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Show pieces marked as Not Safe For Work in your feeds. 
              <br/>By enabling this, you confirm you are at least 18 years old.
            </p>
          </div>
          <Switch
            id="nsfw"
            checked={nsfwEnabled}
            onCheckedChange={setNsfwEnabled}
          />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </form>

      <h2 className="mt-12 mb-3 font-display text-xl text-foreground">
        Creator Account
      </h2>
      <div className="surface-elevated space-y-4 rounded-md p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-foreground">Author Mode</p>
            <p className="text-sm text-muted-foreground">
              Enable author mode to write drafts, manage branches, set up tiers,
              and receive tips/sales.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isCreator}
            aria-label="Author mode"
            onClick={handleToggleAuthorMode}
            disabled={toggling}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none ${
              isCreator ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`pointer-events-none inline-block size-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                isCreator ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        {isCreator && (
          <>
            <div className="border-t border-border pt-4">
              <Label htmlFor="set-byok-provider">AI Provider (BYOK)</Label>
              <Select
                value={byokProvider}
                onValueChange={(val) => {
                  setByokProvider(val)
                  setByokModel("")
                  setIsCustomModel(false)
                }}
              >
                <SelectTrigger id="set-byok-provider" className="mt-1 w-full">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  {byokProviders().map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="set-byok-key">API Key</Label>
                  <Input
                    id="set-byok-key"
                    type="password"
                    value={byokApiKey}
                    onChange={(e) => setByokApiKey(e.target.value)}
                    placeholder={
                      byokProvider === "ollama"
                        ? "Not required"
                        : byokKeySet
                          ? "•••••••• (saved — enter a new key to replace)"
                          : "sk-..."
                    }
                    className="mt-1"
                    disabled={byokProvider === "ollama"}
                  />
                  {byokKeySet && !byokApiKey.trim() && byokProvider !== "ollama" && (
                    <button
                      type="button"
                      onClick={clearByokKey}
                      className="mt-1.5 text-xs text-muted-foreground underline underline-offset-2 hover:text-destructive"
                    >
                      Remove saved key
                    </button>
                  )}
                </div>
                <div>
                  <Label htmlFor="set-byok-model">Model Name</Label>
                  {!isCustomModel ? (
                    <Select
                      value={byokModel || "default"}
                      onValueChange={(val) => {
                        if (val === "custom") {
                          setIsCustomModel(true)
                          setByokModel("")
                        } else if (val === "default") {
                          setByokModel("")
                        } else {
                          setByokModel(val)
                        }
                      }}
                    >
                      <SelectTrigger id="set-byok-model" className="mt-1 w-full">
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        {(DEFAULT_MODELS[byokProvider] || []).map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">+ Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="mt-1 flex gap-2">
                      <Input
                        id="set-byok-model"
                        value={byokModel}
                        onChange={(e) => setByokModel(e.target.value)}
                        placeholder="e.g. gpt-4o, claude-3-5-sonnet..."
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsCustomModel(false)
                          setByokModel("")
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Enter your own API key to bypass the free platform rate limits
                for AI features. Model name overrides the default for that
                provider.
              </p>
            </div>
          </>
        )}
      </div>

      <h2 className="mt-12 mb-3 flex items-center gap-2 font-display text-xl text-foreground">
        Data Export
        {!hasStudio && (
          <span className="flex items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-medium tracking-wide text-primary">
            <Lock className="size-3" /> Studio
          </span>
        )}
      </h2>
      <div className="surface-elevated space-y-4 rounded-md p-6">
        <div>
          <p className="font-medium text-foreground">Download Archive</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Get a full JSON export of your profile, pieces, blocks, and
            branches.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            disabled={!hasStudio}
            onClick={() => {
              window.open("/api/export", "_blank")
            }}
          >
            Download Full Export
          </Button>
          {!hasStudio && (
            <p className="mt-2 text-xs text-primary">Upgrade to Studio to export your data.</p>
          )}
        </div>

        {isCreator && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="font-medium text-foreground">Export Subscribers</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Download your full audience list as a CSV file. You own this data.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              disabled={!hasStudio}
              onClick={() => {
                window.open("/api/export/subscribers", "_blank")
              }}
            >
              Export CSV
            </Button>
            {!hasStudio && (
              <p className="mt-2 text-xs text-primary">Upgrade to Studio to export your subscribers.</p>
            )}
          </div>
        )}
      </div>

      <h2 className="mt-12 mb-3 flex items-center gap-2 font-display text-xl text-foreground">
        <ShieldCheck className="size-5" /> Two-factor authentication
      </h2>
      <div className="surface-elevated space-y-3 rounded-md p-6">
        {checkingMfa ? (
          <p className="text-sm text-muted-foreground">Checking 2FA status…</p>
        ) : mfaStatus.enabled ? (
          <div className="space-y-4">
            <p className="text-sm font-medium text-success">
              Two-factor authentication is active and securing your account.
            </p>
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm">
                  Disable 2FA
                </Button>
              }
              title="Disable two-factor authentication?"
              description="This will lower your account security. You will need to scan a new QR code if you enable it again later."
              destructive
              confirmLabel="Disable"
              onConfirm={disableMfa}
            />
          </div>
        ) : !mfaQr ? (
          <>
            <p className="text-sm text-muted-foreground">
              Add an authenticator app (1Password, Authy, Google Authenticator)
              for an extra layer of security on sign-in.
            </p>
            <Button
              variant="outline"
              onClick={startMfa}
              disabled={enrollingMfa}
            >
              {enrollingMfa ? "Preparing…" : "Enable 2FA"}
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Scan this QR with your authenticator, then enter the 6-digit code.
            </p>
            <Image
              src={mfaQr.qr}
              alt="MFA QR"
              width={176}
              height={176}
              unoptimized
              className="size-44 rounded bg-white p-2"
            />
            <p className="font-mono text-xs break-all text-muted-foreground">
              Secret: {mfaQr.secret}
            </p>
            <div className="flex gap-2">
              <Input
                aria-label="Authentication code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                className="w-32"
              />
              <Button onClick={verifyMfa}>Verify & enable</Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setMfaQr(null)
                  setMfaCode("")
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <h2 className="mt-12 mb-3 font-display text-xl text-foreground">
        Billing & Plans
      </h2>
      <div className="surface-elevated space-y-4 rounded-md p-6">
        <div>
          {launchFree ? (
            <>
              <p className="font-medium text-foreground">Free launch — all features unlocked</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Paid plans are on hold while we launch. Join the waitlist to hear when they open.
              </p>
            </>
          ) : (
            <p className="font-medium text-foreground">
              Current Plan: <span className="capitalize">{plan === "reader" ? "Reader Pass" : plan}</span>
            </p>
          )}
        </div>
        {launchFree && <WaitlistButton item="studio" source="settings" signedIn />}
      </div>

      <h2 className="mt-12 mb-3 font-display text-xl text-foreground">
        Appearance
      </h2>
      <div className="surface-elevated space-y-3 rounded-md p-6">
        <p className="font-medium text-foreground">Accent colour</p>
        <AccentPicker />
      </div>

      <h2 className="mt-12 mb-3 font-display text-xl text-foreground">
        Accessibility Verification
      </h2>
      <AccessibilitySettings />

      <h2 className="mt-12 mb-3 font-display text-xl text-destructive">
        Danger zone
      </h2>
      <div className="space-y-4 rounded-md border border-destructive/40 p-6">
        <div>
          <p className="font-medium text-foreground">Delete account</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently delete your profile, all pieces, branches, bundles, and
            tiers. Purchases and supporters&apos; records will remain in
            archived form.
          </p>
        </div>
        <ConfirmDialog
          trigger={<Button variant="destructive">Delete my account</Button>}
          title="Delete your account?"
          description="This action is permanent and cannot be undone."
          destructive
          typedConfirm="delete my account"
          confirmLabel="Delete forever"
          onConfirm={deleteAccount}
        />
      </div>
    </div>
  )
}

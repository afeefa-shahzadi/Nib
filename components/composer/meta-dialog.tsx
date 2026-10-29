/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { Wand2, ImageIcon, X, Trash2, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import Image from "next/image"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase/client"
import { addCreatorSponsorship, getActiveSponsorships, removeCreatorSponsorship } from "@/actions/monetization"

interface MetaDialogProps {
  pieceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  summary: string
  setSummary: (value: string) => void
  thesis: string
  setThesis: (value: string) => void
  tags: string
  setTags: (value: string) => void
  tipsEnabled: boolean
  setTipsEnabled: (value: boolean) => void
  sponsorshipEnabled: boolean
  setSponsorshipEnabled: (value: boolean) => void
  repostCreditsRequired: boolean
  setRepostCreditsRequired: (value: boolean) => void
  isNsfw: boolean
  setIsNsfw: (value: boolean) => void
  isAiGenerated: boolean
  setIsAiGenerated: (value: boolean) => void
  allowInlineComments: boolean
  setAllowInlineComments: (value: boolean) => void
  onSuggestMeta: () => Promise<void>
  aiMetaBusy: boolean
}

type Sponsor = {
  id: string
  sponsor_name: string
  disclosure_text: string
  sponsor_logo_url: string
}

export function MetaDialog({
  pieceId,
  open,
  onOpenChange,
  summary,
  setSummary,
  thesis,
  setThesis,
  tags,
  setTags,
  tipsEnabled,
  setTipsEnabled,
  sponsorshipEnabled,
  setSponsorshipEnabled,
  repostCreditsRequired,
  setRepostCreditsRequired,
  isNsfw,
  setIsNsfw,
  isAiGenerated,
  setIsAiGenerated,
  allowInlineComments,
  setAllowInlineComments,
  onSuggestMeta,
  aiMetaBusy,
}: MetaDialogProps) {
  const [sponsorsList, setSponsorsList] = useState<Sponsor[]>([])
  const [sponsorName, setSponsorName] = useState("")
  const [sponsorUrl, setSponsorUrl] = useState("")
  const [sponsorLogoUrl, setSponsorLogoUrl] = useState("")
  const [disclosureText, setDisclosureText] = useState("Supported by")
  const [isSavingSponsor, setIsSavingSponsor] = useState(false)
  const [isRemovingSponsor, setIsRemovingSponsor] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch existing sponsorship if any
  useEffect(() => {
    if (!open || !pieceId) return
    let isMounted = true
    getActiveSponsorships({ data: { contentObjectId: pieceId } }).then((s) => {
      if (isMounted) setSponsorsList((s || []) as Sponsor[])
    })
    return () => {
      isMounted = false
    }
  }, [open, pieceId])

  const fetchSponsors = useCallback(async () => {
    if (!pieceId) return
    const s = await getActiveSponsorships({ data: { contentObjectId: pieceId } })
    setSponsorsList((s || []) as Sponsor[])
  }, [pieceId])

  const handleUrlBlur = () => {
    if (sponsorUrl && !sponsorLogoUrl) {
      try {
        const url = new URL(sponsorUrl.startsWith("http") ? sponsorUrl : `https://${sponsorUrl}`)
        setSponsorLogoUrl(`https://icon.horse/icon/${url.hostname}`)
      } catch {
        // invalid URL
      }
    }
  }

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const toastId = toast.loading("Uploading logo...")
    try {
      const path = `sponsorships/${crypto.randomUUID()}-${file.name}`
      const { error } = await supabase.storage.from("images").upload(path, file)
      if (error) throw error
      const { data: pub } = supabase.storage.from("images").getPublicUrl(path)
      setSponsorLogoUrl(pub.publicUrl)
      toast.success("Logo uploaded", { id: toastId })
    } catch (err: any) {
      toast.error((err as Error).message || "Failed to upload logo", { id: toastId })
    }
  }

  const handleSaveSponsorship = async () => {
    if (!sponsorName) {
      toast.error("Sponsor Name is required")
      return
    }
    setIsSavingSponsor(true)
    try {
      await addCreatorSponsorship({
        data: {
          contentObjectId: pieceId,
          sponsorName,
          sponsorUrl,
          sponsorLogoUrl,
          disclosureText,
        }
      })
      toast.success("Sponsor added!")
      setSponsorName("")
      setSponsorUrl("")
      setSponsorLogoUrl("")
      setDisclosureText("Supported by")
      fetchSponsors()
    } catch (err: any) {
      toast.error((err as Error).message || "Failed to add sponsor")
    } finally {
      setIsSavingSponsor(false)
    }
  }

  const handleRemoveSponsorship = async (sponsorshipId: string) => {
    setIsRemovingSponsor(sponsorshipId)
    try {
      await removeCreatorSponsorship({
        data: { sponsorshipId, contentObjectId: pieceId }
      })
      toast.success("Sponsor removed!")
      fetchSponsors()
    } catch (err: any) {
      toast.error((err as Error).message || "Failed to remove sponsor")
    } finally {
      setIsRemovingSponsor(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Piece meta</DialogTitle>
          <DialogDescription>
            Settings for your piece. Autosaves.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="meta" className="flex flex-col flex-1 min-h-0 w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="meta">General Settings</TabsTrigger>
            <TabsTrigger value="sponsors">Sponsors</TabsTrigger>
          </TabsList>

          <TabsContent value="meta" className="flex-1 min-h-0 overflow-y-auto w-full p-2 mt-4 space-y-4">
            <div>
              <p className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
                Summary
              </p>
              <Textarea
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Summary (≤160 chars)"
              />
            </div>
            <div>
              <p className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
                Canonical thesis
              </p>
              <Textarea
                rows={2}
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
                placeholder="The single claim this piece defends"
              />
            </div>
            <div>
              <p className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
                Tags
              </p>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tags, comma-separated"
              />
            </div>

            <div className="hairline-t space-y-4 pt-4">
              <p className="text-[10px] tracking-wider text-muted-foreground uppercase">
                Monetization
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="tips">Accept tips</Label>
                  <p className="text-xs text-muted-foreground">
                    Readers can send you a tip on this piece.
                  </p>
                </div>
                <Switch
                  id="tips"
                  checked={tipsEnabled}
                  onCheckedChange={setTipsEnabled}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="spons">Allow public sponsorship</Label>
                  <p className="text-xs text-muted-foreground">
                    Allow readers and organizations to buy sponsorships for this piece.
                  </p>
                </div>
                <Switch
                  id="spons"
                  checked={sponsorshipEnabled}
                  onCheckedChange={setSponsorshipEnabled}
                />
              </div>
              <div className="flex items-center justify-between mt-4">
                <div>
                  <Label htmlFor="rc">Require credit on reposts</Label>
                  <p className="text-xs text-muted-foreground">
                    Forces a credit block when others repost this piece.
                  </p>
                </div>
                <Switch
                  id="rc"
                  checked={repostCreditsRequired}
                  onCheckedChange={setRepostCreditsRequired}
                />
              </div>
              <div className="flex items-center justify-between mt-4">
                <div>
                  <Label htmlFor="nsfw">Mark as NSFW</Label>
                  <p className="text-xs text-muted-foreground">
                    Flag this piece as Not Safe For Work.
                  </p>
                </div>
                <Switch
                  id="nsfw"
                  checked={isNsfw}
                  onCheckedChange={setIsNsfw}
                />
              </div>
              <div className="flex items-center justify-between mt-4">
                <div>
                  <Label htmlFor="ai-generated">Made with AI</Label>
                  <p className="text-xs text-muted-foreground">
                    Show readers an AI content label on this piece.
                  </p>
                </div>
                <Switch
                  id="ai-generated"
                  checked={isAiGenerated}
                  onCheckedChange={setIsAiGenerated}
                />
              </div>
              <div className="flex items-center justify-between mt-4">
                <div>
                  <Label htmlFor="inline-comments">Allow Inline Comments</Label>
                  <p className="text-xs text-muted-foreground">
                    Readers can select text and start public comment threads.
                  </p>
                </div>
                <Switch
                  id="inline-comments"
                  checked={allowInlineComments}
                  onCheckedChange={setAllowInlineComments}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sponsors" className="flex-1 min-h-0 overflow-y-auto w-full p-2 mt-4 space-y-6">
            {sponsorsList.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Active Sponsors</h4>
                <div className="grid gap-3">
                  {sponsorsList.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 border rounded-xl bg-muted/10">
                      <div className="flex items-center gap-3">
                        {s.sponsor_logo_url ? (
                          <Image src={s.sponsor_logo_url} width={40} height={40} className="size-10 rounded-lg object-cover border" alt="logo" unoptimized />
                        ) : (
                          <div className="size-10 bg-accent rounded-lg border flex items-center justify-center">
                            <ImageIcon className="size-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{s.sponsor_name}</p>
                          <p className="text-xs text-muted-foreground">{s.disclosure_text}</p>
                        </div>
                      </div>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleRemoveSponsorship(s.id)}
                        disabled={isRemovingSponsor === s.id}
                      >
                        {isRemovingSponsor === s.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border p-4 space-y-4 bg-muted/20">
              <h4 className="text-sm font-medium">Add New Sponsor</h4>
              <div className="grid gap-2">
                <Label>Sponsor Name *</Label>
                <Input
                  value={sponsorName}
                  onChange={e => setSponsorName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Sponsor URL</Label>
                  <Input
                    value={sponsorUrl}
                    onChange={e => setSponsorUrl(e.target.value)}
                    onBlur={handleUrlBlur}
                    placeholder="https://acme.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Disclosure Text</Label>
                  <Input
                    value={disclosureText}
                    onChange={e => setDisclosureText(e.target.value)}
                    placeholder="e.g. Supported by"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Sponsor Logo</Label>
                {sponsorLogoUrl ? (
                  <div className="relative group w-fit">
                    <Image
                      src={sponsorLogoUrl}
                      alt="Logo"
                      width={64}
                      height={64}
                      unoptimized
                      className="rounded-lg border object-cover size-16"
                      onError={() => {
                        setSponsorLogoUrl("")
                        toast.error("Could not fetch logo automatically. Please upload manually.")
                      }}
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 size-6 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => setSponsorLogoUrl("")}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-fit"
                  >
                    <ImageIcon className="mr-2 size-4" /> Upload Logo
                  </Button>
                )}
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleUploadLogo} />
                <p className="text-xs text-muted-foreground mt-1">If you enter a Sponsor URL, we will automatically try to fetch the logo.</p>
              </div>
              <Button
                onClick={handleSaveSponsorship}
                disabled={isSavingSponsor || !sponsorName}
                className="w-full mt-2"
              >
                {isSavingSponsor ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
                {isSavingSponsor ? "Adding..." : "Add Sponsor"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="ghost" onClick={onSuggestMeta} disabled={aiMetaBusy}>
            <Wand2 className="mr-1 size-3.5" />
            {aiMetaBusy ? "Thinking…" : "AI suggest"}
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

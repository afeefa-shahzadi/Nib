"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Users, Mail } from "lucide-react"
import { bulkInviteMembers } from "@/actions/orgs"

export function BulkInvite({ orgId }: { orgId: string }) {
  const [emails, setEmails] = useState("")
  const [inviting, setInviting] = useState(false)

  const handleInvite = async () => {
    const list = emails.split(/[\n,]+/).map((e) => e.trim()).filter(Boolean)
    if (list.length === 0) {
      toast.error("Please enter at least one email.")
      return
    }
    
    setInviting(true)
    try {
      await bulkInviteMembers({ data: { org_id: orgId, emails: list } })
      
      toast.success(`Successfully sent invites to ${list.length} people.`)
      setEmails("")
    } catch {
      toast.error("Failed to send invites")
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Users className="size-5 text-primary" />
        </div>
        <div>
          <h3 className="font-display text-lg">Bulk Invite</h3>
          <p className="text-sm text-muted-foreground">Invite members or students to your organization space.</p>
        </div>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Email Addresses (comma separated or one per line)</label>
          <Textarea 
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="student1@university.edu&#10;student2@university.edu"
            className="mt-1.5 font-mono text-sm"
            rows={5}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Mail className="size-3.5" /> Invites will be emailed immediately.
          </span>
          <Button onClick={handleInvite} disabled={inviting || !emails.trim()}>
            {inviting ? "Sending..." : "Send Invites"}
          </Button>
        </div>
      </div>
    </div>
  )
}

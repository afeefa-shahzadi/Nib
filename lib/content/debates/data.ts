 
import { AccessMode } from "@/lib/types/content"

export const ACCESS_LABEL: Record<AccessMode, string> = {
  public: "Public — anyone can read; sign-in only to post",
  members: "Members — any active subscriber of yours",
  tier: "Specific tier — pick which tier unlocks access",
  invite: "Invite-only — pick people from your follows",
  org: "Organization — only members of your org can join",
}

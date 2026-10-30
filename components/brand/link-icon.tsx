import { Link2 } from "lucide-react"
import { linkLabel, normalizeLink } from "@/lib/profile-links"
import { GithubIcon, InstagramIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from "@/components/brand/social-icons"

// Brand icon for a profile link (X, GitHub…), or a plain link icon. Accepts "x.com/you" too.
export function LinkIcon({ url, className = "size-4" }: { url: string; className?: string }) {
  const full = normalizeLink(url)
  switch (full && linkLabel(full)) {
    case "X":
      return <TwitterIcon className={className} aria-hidden />
    case "GitHub":
      return <GithubIcon className={className} aria-hidden />
    case "LinkedIn":
      return <LinkedinIcon className={className} aria-hidden />
    case "Instagram":
      return <InstagramIcon className={className} aria-hidden />
    case "YouTube":
      return <YoutubeIcon className={className} aria-hidden />
    default:
      return <Link2 className={className} aria-hidden />
  }
}

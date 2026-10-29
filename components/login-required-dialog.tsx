import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  title?: string
  description?: string
  redirectTo: string
}

export function LoginRequiredDialog({
  open,
  onOpenChange,
  title = "Sign in to continue",
  description = "You need an account to do that. We'll bring you right back here after.",
  redirectTo,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button asChild variant="outline">
            <Link href={`/signup?redirect=${redirectTo}`}>Create account</Link>
          </Button>
          <Button asChild>
            <Link href={`/login?redirect=${redirectTo}`}>Sign in</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

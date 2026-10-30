import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { verifyConsentLink } from "@/lib/parental-consent"
import { grantParentalConsent } from "@/actions/parental-consent"
import { cardCheckEnabled, digilockerEnabled } from "@/lib/consent-methods"
import { CardCheck } from "./card-check"

const ERRORS: Record<string, string> = {
  not_adult: "DigiLocker shows the holder is under 18. A parent or guardian aged 18 or over needs to approve.",
  digilocker: "DigiLocker didn't finish. Try again, or use another way below.",
}

export const metadata: Metadata = { title: "Approve an account — Nib", robots: { index: false } }

type SP = { u?: string; t?: string; error?: string }

export default async function ParentalConsentPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { u = "", t = "", error } = await searchParams
  let failure = error ? ERRORS[error] : undefined
  const child = u && t ? await verifyConsentLink(u, t).catch(() => null) : null

  async function approve(form: FormData) {
    "use server"
    const back = `/parental-consent?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}`
    try {
      await grantParentalConsent(u, t, form.get("adult") === "on")
    } catch (e) {
      redirect(`${back}&error=${encodeURIComponent((e as Error).message)}`)
    }
    redirect(back)
  }
  if (error && !failure) failure = error.slice(0, 200)

  return (
    <main className="container-wide grid items-start gap-10 pt-16 pb-16 md:pt-24 md:pb-24 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-5">
        <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">Approve an account</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Nib asks a parent to approve accounts for anyone aged 13 to 17 before they can publish or post.
        </p>
      </div>
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 sm:p-8 lg:col-span-6 lg:col-start-7">
        {!child ? (
          <>
            <h2 className="font-display text-2xl">This link doesn&apos;t work</h2>
            <p className="mt-2 text-muted-foreground">
              It may have been copied incompletely. Ask your child to send the request again from their account.
            </p>
          </>
        ) : child.parental_consent !== "pending" ? (
          <>
            <h2 className="font-display text-2xl">Approved</h2>
            <p className="mt-2 text-muted-foreground">
              {child.display_name} (@{child.handle}) can now publish, comment and join debates. Thank you.
            </p>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl">
              {child.display_name} <span className="text-muted-foreground">@{child.handle}</span>
            </h2>
            <p className="mt-2 text-muted-foreground">gave this email as a parent&apos;s when signing up.</p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>Approving lets them publish pieces, comment and take part in debates.</li>
              <li>Their date of birth and your email stay private and are never shown on their profile.</li>
              <li>Mature content stays hidden from them until they turn 18.</li>
              <li>
                You can ask us to remove the account at any time:{" "}
                <a href="mailto:writeson.nib@gmail.com" className="text-primary hover:underline">writeson.nib@gmail.com</a>.
              </li>
            </ul>
            {failure && <p role="alert" className="mt-6 text-sm text-destructive">{failure}</p>}
            <form action={approve} className="mt-8 space-y-4">
              <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
                <input id="declare-adult" name="adult" type="checkbox" required className="mt-0.5 size-4 shrink-0 accent-primary" />
                <span>I&apos;m their parent or legal guardian, and I&apos;m 18 or older.</span>
              </label>
              <Button type="submit" className="w-full">Approve</Button>
              {(digilockerEnabled() || cardCheckEnabled()) && (
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-muted-foreground">Or confirm you&apos;re an adult another way:</p>
                  {digilockerEnabled() && (
                    <Button asChild variant="outline" className="w-full">
                      <a href={`/api/consent/digilocker?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}`}>Verify with DigiLocker</a>
                    </Button>
                  )}
                  {cardCheckEnabled() && <CardCheck u={u} t={t} />}
                </div>
              )}
            </form>
            <p className="mt-4 text-sm text-muted-foreground">Don&apos;t approve? Close this page. The account stays read-only.</p>
          </>
        )}
      </div>
    </main>
  )
}

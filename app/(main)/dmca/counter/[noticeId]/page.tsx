import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CounterForm } from "./counter-form"

export default async function CounterNoticePage({
  params,
}: {
  params: Promise<{ noticeId: string }>
}) {
  const { noticeId } = await params
  const { data } = await (await createClient()).auth.getUser()
  if (!data?.user) redirect(`/login?next=/dmca/counter/${noticeId}`)

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-6 md:p-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl tracking-tight">File a counter-notice</h1>
        <p className="text-sm text-muted-foreground">
          If your content was disabled by mistake or misidentification, you may file a
          counter-notice. The claimant will be notified. This is not legal advice.
        </p>
      </header>
      <CounterForm noticeId={noticeId} />
    </div>
  )
}

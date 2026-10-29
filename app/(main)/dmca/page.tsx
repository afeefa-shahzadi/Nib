import type { Metadata } from "next"
import { DMCA_AGENT, GRIEVANCE_OFFICER } from "@/lib/legal/contacts"
import { NoticeForm } from "./notice-form"

export const metadata: Metadata = {
  title: "Copyright & Grievance",
  description: "File a copyright infringement notice or a grievance.",
}

export default async function DmcaPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const noticeType = type === "grievance" ? "grievance" : "dmca"
  const contact = noticeType === "grievance" ? GRIEVANCE_OFFICER : DMCA_AGENT

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 pt-16 pb-6 md:px-8 md:pt-24 md:pb-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl tracking-tight">
          {noticeType === "grievance" ? "Grievance" : "Copyright notice"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {noticeType === "grievance"
            ? "Report a grievance to our India grievance officer."
            : "Report content that infringes your copyright. We review every notice before acting; filing a notice does not remove content automatically."}
        </p>
      </header>

      <section className="hairline rounded-lg p-4 text-sm">
        <p className="font-medium">{contact.name}</p>
        <p className="text-muted-foreground">{contact.email}</p>
        <p className="text-muted-foreground">{contact.address}</p>
      </section>

      <NoticeForm noticeType={noticeType} />

      <p className="text-xs text-muted-foreground">
        Filing a false notice may carry legal liability. This page is not legal advice.
      </p>
    </div>
  )
}

import type { Metadata } from "next"
import Link from "next/link"
import { DMCA_AGENT, GRIEVANCE_OFFICER } from "@/lib/legal/contacts"
import { NoticeForm } from "./notice-form"

export const metadata: Metadata = {
  title: "Copyright & grievances — Nib",
  description: "File a copyright infringement notice or a grievance.",
}

// Placeholders like "[name]" in lib/legal/contacts.ts are never shown publicly.
const filled = (v: string) => (v && !v.startsWith("[") ? v : null)

export default async function DmcaPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const grievance = type === "grievance"
  const contact = grievance ? GRIEVANCE_OFFICER : DMCA_AGENT

  return (
    <main className="container-wide grid items-start gap-10 pt-16 pb-16 md:pt-24 md:pb-24 lg:grid-cols-12 lg:gap-12">
      <div className="lg:sticky lg:top-24 lg:col-span-5">
        <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">
          {grievance ? "File a grievance" : "Report a copyright issue"}
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-foreground/85">
          {grievance
            ? "Raise a complaint with our grievance officer for India, as the IT Rules, 2021 provide."
            : "Tell us about content on Nib that infringes your copyright. A person reviews every notice; filing one doesn't remove anything automatically."}
        </p>
        <dl className="mt-10 space-y-4">
          <div>
            <dt className="text-sm text-muted-foreground">{grievance ? "Grievance officer" : "Copyright agent"}</dt>
            {filled(contact.name) && <dd className="mt-1">{filled(contact.name)}</dd>}
            <dd className="mt-1">
              <a href={`mailto:${contact.email}`} className="-my-3 inline-block py-3 font-medium text-primary hover:underline hover:underline-offset-4">
                {contact.email}
              </a>
            </dd>
            {filled(contact.address) && <dd className="mt-1 text-muted-foreground">{filled(contact.address)}</dd>}
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{grievance ? "About copyright instead?" : "Something other than copyright?"}</dt>
            <dd className="mt-1">
              <Link
                href={grievance ? "/dmca" : "/dmca?type=grievance"}
                className="-my-3 inline-block py-3 font-medium text-primary hover:underline hover:underline-offset-4"
              >
                {grievance ? "Report a copyright issue →" : "File a grievance →"}
              </Link>
            </dd>
          </div>
        </dl>
        <p className="mt-10 text-sm text-muted-foreground">
          Filing a false notice may carry legal liability. This page is not legal advice.
        </p>
      </div>
      <div className="lg:col-span-7">
        <NoticeForm noticeType={grievance ? "grievance" : "dmca"} />
      </div>
    </main>
  )
}

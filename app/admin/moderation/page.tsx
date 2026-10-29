import { redirect } from "next/navigation"
import { ShieldAlert } from "lucide-react"
import { getMyRole } from "@/actions/content/profile"
import { listReports, listAppeals } from "@/actions/moderation"
import { listDmcaNotices, listDmcaCounterNotices } from "@/actions/dmca"
import { ModerationQueue, type ModerationReport } from "./moderation-queue"
import { AppealsQueue } from "./appeals-queue"
import { DmcaQueue, type DmcaNotice, type DmcaCounter } from "./dmca-queue"

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ dmca?: string }>
}) {
  const { primary } = await getMyRole()
  if (primary !== "admin") redirect("/")

  const { dmca } = await searchParams
  const dmcaStatus = ["received", "actioned", "rejected"].includes(dmca ?? "")
    ? (dmca as string)
    : "received"

  const reports = (await listReports()) as ModerationReport[]
  const appeals = await listAppeals()
  const dmcaNotices = (await listDmcaNotices(dmcaStatus)) as DmcaNotice[]
  const dmcaCounters = (await listDmcaCounterNotices()) as DmcaCounter[]

  return (
    <div className="mx-auto w-full max-w-350 space-y-8 p-6 md:p-8">
      <header>
        <p className="mb-2 inline-flex items-center gap-2 text-xs tracking-[0.2em] text-muted-foreground uppercase">
          <ShieldAlert className="size-3.5" /> Admin
        </p>
        <h1 className="font-display text-3xl tracking-tight">Moderation queue</h1>
      </header>

      <section>
        <ModerationQueue reports={reports} />
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl tracking-tight">
          Restriction appeals
        </h2>
        <AppealsQueue appeals={appeals} />
      </section>

      <section>
        <DmcaQueue notices={dmcaNotices} counters={dmcaCounters} activeStatus={dmcaStatus} />
      </section>
    </div>
  )
}

export type NoticeInput = {
  notice_type: "dmca" | "grievance"
  // Optional: external rightsholders file by URL, not the internal content
  // object id. When absent it is resolved server-side from infringing_urls.
  target_content_object_id?: string | null
  complainant_name: string
  complainant_email: string
  complainant_address: string
  complainant_role: "owner" | "agent"
  work_identification: string
  infringing_urls: string[]
  good_faith_statement: boolean
  accuracy_statement: boolean
  signature: string
}

export type CounterNoticeInput = {
  notice_id: string
  statement: string
  consent_jurisdiction: boolean
  good_faith: boolean
  signature: string
  contact: string
}

export type ValidationResult = { ok: true } | { ok: false; errors: Record<string, string> }

const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0
// Loose format check — a syntactic gate, not verification. Real abuse control
// is that nothing acts on a notice until an admin reviews it.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateNotice(input: Partial<NoticeInput>): ValidationResult {
  const errors: Record<string, string> = {}
  if (input.notice_type !== "dmca" && input.notice_type !== "grievance")
    errors.notice_type = "Choose a notice type."
  if (!nonEmpty(input.complainant_name)) errors.complainant_name = "Your name is required."
  if (!nonEmpty(input.complainant_email)) errors.complainant_email = "A contact email is required."
  else if (!EMAIL_RE.test(input.complainant_email.trim()))
    errors.complainant_email = "Enter a valid email address."
  if (!nonEmpty(input.complainant_address))
    errors.complainant_address = "A contact address is required."
  if (input.complainant_role !== "owner" && input.complainant_role !== "agent")
    errors.complainant_role = "State your relationship to the work."
  if (!nonEmpty(input.work_identification))
    errors.work_identification = "Identify the copyrighted work."
  if (!Array.isArray(input.infringing_urls) || input.infringing_urls.filter(nonEmpty).length === 0)
    errors.infringing_urls = "Provide at least one infringing URL."
  if (input.good_faith_statement !== true)
    errors.good_faith_statement = "This statement is required."
  if (input.accuracy_statement !== true) errors.accuracy_statement = "This statement is required."
  if (!nonEmpty(input.signature)) errors.signature = "An electronic signature is required."
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true }
}

export function validateCounterNotice(input: Partial<CounterNoticeInput>): ValidationResult {
  const errors: Record<string, string> = {}
  if (!nonEmpty(input.notice_id)) errors.notice_id = "Missing the claim reference."
  if (!nonEmpty(input.statement)) errors.statement = "A statement is required."
  if (input.consent_jurisdiction !== true)
    errors.consent_jurisdiction = "This consent is required."
  if (input.good_faith !== true) errors.good_faith = "This statement is required."
  if (!nonEmpty(input.signature)) errors.signature = "An electronic signature is required."
  if (!nonEmpty(input.contact)) errors.contact = "Contact details are required."
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true }
}

// Add N business days (skip Sat/Sun) in UTC. ponytail: no holiday calendar —
// §512 counts business days; add a holiday table only if counsel requires it.
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from)
  let added = 0
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1)
    const dow = d.getUTCDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return d
}

export function restoreEligibleAt(from: Date, businessDays = 10): string {
  return addBusinessDays(from, businessDays).toISOString()
}

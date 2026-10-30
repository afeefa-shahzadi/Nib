// Contact form topics and server-side validation. Only sales-type topics ask
// for an organization; everything else is a person writing in.
export const CONTACT_TOPICS = {
  general: "General question",
  bug: "Report a bug",
  suggestion: "Suggest a feature",
  enterprise: "Enterprise",
  education: "Education",
  partnership: "Partnership",
} as const
export type ContactTopic = keyof typeof CONTACT_TOPICS
export const ORG_TOPICS: ContactTopic[] = ["enterprise", "education", "partnership"]

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")

export function validateContact(body: Record<string, unknown>): string | null {
  const intent = str(body.intent)
  if (!(intent in CONTACT_TOPICS)) return "Choose a topic."
  if (!str(body.fullName)) return "Enter your name."
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(body.email))) return "Enter a valid email."
  if (ORG_TOPICS.includes(intent as ContactTopic) && !str(body.organizationName))
    return "Enter your organization."
  const details = str(body.details)
  if (!details) return "Tell us how we can help."
  if (details.length > 5000) return "Keep your message under 5,000 characters."
  return null
}

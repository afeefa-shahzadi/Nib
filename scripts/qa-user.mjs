// QA test user on the Supabase project in the env file, signed in by magic
// link so no password exists. Re-running reuses the user and prints a new link.
//   node --env-file=.env.local scripts/qa-user.mjs [email] [handle]
import { createClient } from "@supabase/supabase-js"

const email = process.argv[2] || "qa.reader@nib.test"
const handle = process.argv[3] || "qa_reader"
const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nibwrites.vercel.app"

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

const { data: created, error } = await admin.auth.admin.createUser({
  email,
  email_confirm: true,
  user_metadata: { display_name: "QA Reader", handle },
})
if (error && !/already/i.test(error.message)) throw error

const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email,
})
if (linkErr) throw linkErr

const id = created?.user?.id ?? link.user.id
const { error: profileErr } = await admin
  .from("profiles")
  .update({ handle, display_name: "QA Reader" })
  .eq("id", id)
if (profileErr) console.warn("profile update:", profileErr.message)

console.log(`user ${email} (${id})`)
const confirm = `${site}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink`
console.log(`sign-in link, one use, expires in 1h:\n${confirm}`)

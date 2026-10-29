// Seed auth users + content for the screenshot run. LOCAL Supabase only.
// Idempotent: re-running upserts the same fixed IDs/handles.
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321"
const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!key) throw new Error("SUPABASE_SECRET_KEY not set")
const db = createClient(url, key, { auth: { persistSession: false } })

const PASSWORD = "Passw0rd!demo"

// Fixed UUIDs so re-runs are stable and cross-references are easy.
const ID = {
  reader: "aaaaaaaa-0000-0000-0000-000000000001",
  creator: "aaaaaaaa-0000-0000-0000-000000000002",
  admin: "aaaaaaaa-0000-0000-0000-000000000003",
  workspace: "bbbbbbbb-0000-0000-0000-000000000001",
  org: "cccccccc-0000-0000-0000-000000000001",
  piece: "dddddddd-0000-0000-0000-000000000001",
  draft: "dddddddd-0000-0000-0000-000000000002",
  collection: "eeeeeeee-0000-0000-0000-000000000001",
}

async function upsertUser(id, email) {
  // createUser with explicit id keeps auth.users stable across runs.
  const { error } = await db.auth.admin.createUser({
    id,
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error && !/already|registered|exists/i.test(error.message)) throw error
  // Ensure password/confirmation even if the row already existed.
  await db.auth.admin.updateUserById(id, {
    password: PASSWORD,
    email_confirm: true,
  })
  return id
}

async function main() {
  await upsertUser(ID.reader, "reader@demo.test")
  await upsertUser(ID.creator, "creator@demo.test")
  await upsertUser(ID.admin, "admin@demo.test")

  // Profiles (a DB trigger may auto-create a bare row on signup; upsert over it).
  const up = (t, rows, onConflict) =>
    db.from(t).upsert(rows, { onConflict }).then(({ error }) => {
      if (error) throw new Error(`${t}: ${error.message}`)
    })

  await up(
    "profiles",
    [
      { id: ID.reader, handle: "reader_demo", display_name: "Reader Demo", bio: "A curious reader.", plan: "free", date_of_birth: "1990-01-01" },
      { id: ID.creator, handle: "creator_demo", display_name: "Creator Demo", bio: "Writes long-form pieces.", plan: "studio", date_of_birth: "1990-01-01" },
      { id: ID.admin, handle: "admin_demo", display_name: "Admin Demo", bio: "Platform staff.", plan: "studio", date_of_birth: "1990-01-01" },
    ],
    "id"
  )

  // Roles: creator gets creator; admin gets admin + creator (so /studio renders too).
  await db.from("user_roles").delete().in("user_id", [ID.creator, ID.admin])
  await up("user_roles", [
    { user_id: ID.creator, role: "creator" },
    { user_id: ID.admin, role: "admin" },
    { user_id: ID.admin, role: "creator" },
  ])

  await up("workspaces", [{ id: ID.workspace, owner_id: ID.creator, name: "Creator Demo Studio", slug: "creator-demo" }], "id")
  await up("organizations", [{ id: ID.org, slug: "demo-studio", name: "Demo Studio", owner_id: ID.creator }], "id")

  // Published piece (with blocks) so /u/[handle]/[slug] renders real content.
  await up(
    "content_objects",
    [
      {
        id: ID.piece, workspace_id: ID.workspace, author_id: ID.creator, org_id: ID.org,
        title: "The Shape of Attention", slug: "the-shape-of-attention",
        summary: "How reading modes change what a piece means.",
        status: "published", visibility: "public", tips_enabled: true,
        published_at: "2026-07-01T00:00:00Z",
      },
      {
        id: ID.draft, workspace_id: ID.workspace, author_id: ID.creator, org_id: ID.org,
        title: "Untitled Draft", slug: "untitled-draft",
        status: "draft", visibility: "private",
      },
    ],
    "id"
  )

  await db.from("blocks").delete().eq("content_object_id", ID.piece)
  await up("blocks", [
    { content_object_id: ID.piece, type: "heading", order: 0, content: { text: "The Shape of Attention" } },
    { content_object_id: ID.piece, type: "paragraph", order: 1, content: { text: "Attention is not a spotlight but a shape you pour a text into. Change the vessel and the same words settle differently." } },
    { content_object_id: ID.piece, type: "quote", order: 2, content: { text: "We do not read; we are read by what we choose to attend to." } },
    { content_object_id: ID.piece, type: "paragraph", order: 3, content: { text: "Skim mode keeps the scaffold. Expert mode keeps the load-bearing claims. Teach mode keeps the questions." } },
  ])

  await up("collections", [{ id: ID.collection, title: "Demo Reading List", is_public: true, curator_id: ID.creator, collection_type: "list" }], "id")

  // A pending report (reader flags the piece) -> /admin/moderation shows a row.
  await db.from("content_reports").delete().eq("content_object_id", ID.piece)
  await up("content_reports", [
    { content_object_id: ID.piece, user_id: ID.reader, reason: "nsfw_unflagged", status: "pending", target_type: "piece", target_id: ID.piece },
  ])

  // A pending payout (creator requests) -> /admin/payouts shows a row.
  await db.from("payout_requests").delete().eq("user_id", ID.creator)
  await up("payout_requests", [
    { user_id: ID.creator, amount_paise: 50000, status: "requested", destination: "creator@upi" },
  ])

  // Reader Pass so the reader's subscriber UI is populated.
  await db.from("reader_subscriptions").delete().eq("user_id", ID.reader)
  await up("reader_subscriptions", [
    { user_id: ID.reader, razorpay_subscription_id: "sub_demo_reader", razorpay_plan_id: "plan_demo", status: "active", current_period_end: "2027-01-01T00:00:00Z", ip_granted_until: "2027-01-01T00:00:00Z" },
  ])

  console.log(JSON.stringify({ ok: true, ids: ID, password: PASSWORD }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

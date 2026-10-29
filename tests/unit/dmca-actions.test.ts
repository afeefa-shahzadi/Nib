/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, before, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient, ResolveCtx } from "./fake-supabase"

// Actions build clients via the supabase factories; intercept them. Also stub
// email + rate-limit so no network/SMTP is touched.
let currentFake: ReturnType<typeof makeFakeClient>
mock.module("@/lib/supabase/server", {
  namedExports: {
    createAdminClient: async () => currentFake,
    createClient: async () => currentFake,
    createServiceRoleClient: async () => currentFake,
  },
})
let rlOk = true
mock.module("@/lib/rate-limit.server", {
  namedExports: {
    checkRateLimit: async () => ({ ok: rlOk, remaining: 0, resetAt: new Date() }),
  },
})
const sent: { to: string; subject: string }[] = []
mock.module("@/lib/email", {
  namedExports: {
    sendEmail: async (to: string, subject: string) => {
      sent.push({ to, subject })
      return { ok: true }
    },
  },
})

let dmca: typeof import("@/actions/dmca")
before(async () => {
  dmca = await import("@/actions/dmca")
})

const goodNotice = {
  notice_type: "dmca" as const,
  target_content_object_id: "11111111-1111-1111-1111-111111111111",
  complainant_name: "Jane",
  complainant_email: "JANE@example.com",
  complainant_address: "1 Main St",
  complainant_role: "owner" as const,
  work_identification: "My work",
  infringing_urls: ["https://mycelium.test/x"],
  good_faith_statement: true,
  accuracy_statement: true,
  signature: "Jane",
}

test("fileDmcaNotice: inserts a received notice and returns a reference", async () => {
  rlOk = true
  currentFake = makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "dmca_notices" && op === "insert") return { data: { id: "n1" } }
    return { data: null, error: null }
  })
  const r = await dmca.fileDmcaNotice(goodNotice)
  assert.equal(r.success, true)
  assert.equal(r.reference, "n1")
  const ins = currentFake.calls.find((c) => c.table === "dmca_notices" && c.op === "insert") as any
  assert.equal(ins.rows.status, "received")
  assert.equal(ins.rows.complainant_email, "jane@example.com", "email lower-cased")
})

test("fileDmcaNotice: honeypot filled -> no insert, fake success", async () => {
  currentFake = makeFakeClient((): any => ({ data: null }))
  const r = await dmca.fileDmcaNotice({ ...goodNotice, website: "bot" })
  assert.equal(r.success, true)
  assert.equal(currentFake.calls.length, 0, "no DB write on honeypot hit")
})

test("fileDmcaNotice: invalid notice -> errors, no insert", async () => {
  currentFake = makeFakeClient((): any => ({ data: null }))
  const r = await dmca.fileDmcaNotice({ ...goodNotice, accuracy_statement: false })
  assert.equal(r.success, false)
  assert.ok(r.errors?.accuracy_statement)
  assert.equal(currentFake.calls.length, 0)
})

test("fileDmcaNotice: rate-limited -> rejected", async () => {
  rlOk = false
  currentFake = makeFakeClient((): any => ({ data: { id: "n1" } }))
  const r = await dmca.fileDmcaNotice(goodNotice)
  assert.equal(r.success, false)
  assert.match(r.error ?? "", /too many/i)
  rlOk = true
})

// ---------- admin actions ----------

// user_roles=['admin'] passes requireAdmin; notice/piece/counter rows are the
// resolver's canned reads. getUserById is stubbed on the fake for author email.
function adminFake(opts: {
  roles?: string[]
  notice?: any
  piece?: any
  counter?: any
}) {
  const fake = makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "user_roles") return { data: (opts.roles ?? ["admin"]).map((r) => ({ role: r })) }
    if (table === "dmca_notices" && op === "select") return { data: opts.notice ?? null }
    if (table === "content_objects" && op === "update") return { data: opts.piece ?? null }
    if (table === "content_objects" && op === "select") return { data: opts.piece ?? null }
    if (table === "dmca_counter_notices" && op === "select") return { data: opts.counter ?? null }
    return { data: null, error: null }
  }) as any
  fake.auth.admin = { getUserById: async () => ({ data: { user: { email: "author@x.test" } } }) }
  return fake as ReturnType<typeof makeFakeClient> & { auth: any }
}

test("actionDmcaNotice: non-admin rejected", async () => {
  currentFake = adminFake({ roles: [], notice: { id: "n1", status: "received", target_content_object_id: "c1" } })
  await assert.rejects(() => dmca.actionDmcaNotice({ id: "n1", decision: "disable" }), /Unauthorized/)
})

test("actionDmcaNotice: disable archives the piece, audits, strikes, emails", async () => {
  sent.length = 0
  currentFake = adminFake({
    notice: { id: "n1", status: "received", target_content_object_id: "c1", complainant_email: "jane@x.test" },
    piece: { author_id: "a1", title: "Stolen", slug: "stolen" },
  })
  const r = await dmca.actionDmcaNotice({ id: "n1", decision: "disable" })
  assert.equal(r.success, true)
  const upd = currentFake.calls.find((c) => c.table === "content_objects" && c.op === "update") as any
  assert.equal(upd.vals.status, "archived")
  const audit = currentFake.calls.find((c) => c.table === "moderation_actions" && c.op === "insert") as any
  assert.equal(audit.rows.action, "dmca_disable")
  // applyStrike also emails the author (strike warning); assert the DMCA
  // counter-notice email specifically was sent, not an exact count.
  assert.ok(sent.some((s) => /disabled following a copyright/i.test(s.subject)), "author emailed the DMCA notice")
})

test("actionDmcaNotice: already-actioned notice is a no-op reject", async () => {
  currentFake = adminFake({ notice: { id: "n1", status: "actioned", target_content_object_id: "c1" } })
  const r = await dmca.actionDmcaNotice({ id: "n1", decision: "disable" })
  assert.equal(r.success, false)
  assert.equal(currentFake.calls.find((c) => c.table === "content_objects" && c.op === "update"), undefined)
})

test("actionDmcaNotice: reject sets status, no content change", async () => {
  currentFake = adminFake({ notice: { id: "n1", status: "received", target_content_object_id: "c1" } })
  const r = await dmca.actionDmcaNotice({ id: "n1", decision: "reject", note: "invalid" })
  assert.equal(r.success, true)
  assert.equal(currentFake.calls.find((c) => c.table === "content_objects" && c.op === "update"), undefined)
  const upd = currentFake.calls.find((c) => c.table === "dmca_notices" && c.op === "update") as any
  assert.equal(upd.vals.status, "rejected")
})

test("restoreFromCounterNotice: before eligible date rejected", async () => {
  const future = new Date(Date.now() + 5 * 86400_000).toISOString()
  currentFake = adminFake({ counter: { id: "cn1", notice_id: "n1", status: "forwarded", restore_eligible_at: future } })
  const r = await dmca.restoreFromCounterNotice({ counterNoticeId: "cn1" })
  assert.equal(r.success, false)
  assert.match(r.error ?? "", /not yet eligible/i)
})

test("restoreFromCounterNotice: eligible -> republishes + audits", async () => {
  const past = new Date(Date.now() - 86400_000).toISOString()
  currentFake = adminFake({
    counter: { id: "cn1", notice_id: "n1", status: "forwarded", restore_eligible_at: past },
    notice: { target_content_object_id: "c1" },
    piece: { status: "archived" },
  })
  const r = await dmca.restoreFromCounterNotice({ counterNoticeId: "cn1" })
  assert.equal(r.success, true)
  const upd = currentFake.calls.find((c) => c.table === "content_objects" && c.op === "update") as any
  assert.equal(upd.vals.status, "published")
  const audit = currentFake.calls.find((c) => c.table === "moderation_actions" && c.op === "insert") as any
  assert.equal(audit.rows.action, "dmca_restore")
})

// ---------- fileCounterNotice (author) ----------

// authorFake: getUser() returns the given uid; canned notice/piece/existing rows.
function authorFake(opts: { uid?: string | null; notice?: any; piece?: any; existing?: any }) {
  const fake = makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "dmca_notices" && op === "select") return { data: opts.notice ?? null }
    if (table === "content_objects" && op === "select") return { data: opts.piece ?? null }
    if (table === "dmca_counter_notices" && op === "select") return { data: opts.existing ?? null }
    return { data: null, error: null }
  }, opts.uid === undefined ? "a1" : opts.uid)
  return fake
}

const goodCounter = {
  notice_id: "n1",
  statement: "I own it.",
  consent_jurisdiction: true,
  good_faith: true,
  signature: "Bob",
  contact: "Bob, 2 Side St",
}

test("fileCounterNotice: signed-out rejected", async () => {
  currentFake = authorFake({ uid: null })
  const r = await dmca.fileCounterNotice(goodCounter)
  assert.equal(r.success, false)
  assert.match(r.error ?? "", /sign in/i)
})

test("fileCounterNotice: notice not actioned -> rejected (no live-content clock)", async () => {
  currentFake = authorFake({ notice: { id: "n1", status: "received", target_content_object_id: "c1", complainant_email: "j@x.test" } })
  const r = await dmca.fileCounterNotice(goodCounter)
  assert.equal(r.success, false)
  assert.match(r.error ?? "", /no active claim/i)
})

test("fileCounterNotice: not the owner -> rejected", async () => {
  currentFake = authorFake({
    uid: "someone-else",
    notice: { id: "n1", status: "actioned", target_content_object_id: "c1", complainant_email: "j@x.test" },
    piece: { author_id: "a1", status: "archived" },
  })
  const r = await dmca.fileCounterNotice(goodCounter)
  assert.equal(r.success, false)
  assert.match(r.error ?? "", /not your/i)
})

test("fileCounterNotice: owner files -> inserts, sets clock, emails complainant", async () => {
  sent.length = 0
  currentFake = authorFake({
    uid: "a1",
    notice: { id: "n1", status: "actioned", target_content_object_id: "c1", complainant_email: "jane@x.test" },
    piece: { author_id: "a1", status: "archived" },
  })
  const r = await dmca.fileCounterNotice(goodCounter)
  assert.equal(r.success, true)
  const ins = currentFake.calls.find((c) => c.table === "dmca_counter_notices" && c.op === "insert") as any
  assert.equal(ins.rows.author_id, "a1")
  assert.ok(ins.rows.restore_eligible_at, "restore clock set")
  assert.equal(sent.length, 1, "complainant forwarded the counter-notice")
})

test("fileCounterNotice: duplicate -> idempotent success, no second insert/email", async () => {
  sent.length = 0
  currentFake = authorFake({
    uid: "a1",
    notice: { id: "n1", status: "actioned", target_content_object_id: "c1", complainant_email: "jane@x.test" },
    piece: { author_id: "a1", status: "archived" },
    existing: { id: "cn-existing" },
  })
  const r = await dmca.fileCounterNotice(goodCounter)
  assert.equal(r.success, true)
  assert.equal(currentFake.calls.find((c) => c.table === "dmca_counter_notices" && c.op === "insert"), undefined)
  assert.equal(sent.length, 0)
})

// ---------- final-review fixes ----------

// Critical #1: a counter-notice restore must not republish a piece that was
// independently removed (e.g. hard-removed for an unrelated, legally-mandated
// reason) while the restore clock ran. Only a still-archived piece restores.
test("restoreFromCounterNotice: refuses when piece is no longer archived", async () => {
  const past = new Date(Date.now() - 86400_000).toISOString()
  currentFake = adminFake({
    counter: { id: "cn1", notice_id: "n1", status: "forwarded", restore_eligible_at: past },
    notice: { target_content_object_id: "c1" },
    piece: { status: "deleted" },
  })
  const r = await dmca.restoreFromCounterNotice({ counterNoticeId: "cn1" })
  assert.equal(r.success, false)
  assert.equal(
    currentFake.calls.find((c) => c.table === "content_objects" && c.op === "update"),
    undefined,
    "must not republish an independently-removed piece"
  )
})

// Important #4: a second notice on an already-disabled piece must not stack a
// second strike (abuse-escalation vector) or re-email the author. The notice is
// still cleared from the queue.
test("actionDmcaNotice: disable on an already-archived piece does not re-strike or re-email", async () => {
  sent.length = 0
  currentFake = adminFake({
    notice: { id: "n2", status: "received", target_content_object_id: "c1", complainant_email: "k@x.test" },
    piece: { author_id: "a1", title: "Stolen", slug: "stolen", status: "archived" },
  })
  const r = await dmca.actionDmcaNotice({ id: "n2", decision: "disable" })
  assert.equal(r.success, true)
  assert.ok(
    !sent.some((s) => /disabled following a copyright/i.test(s.subject)),
    "no duplicate strike email on a re-notice"
  )
  const upd = currentFake.calls.find((c) => c.table === "dmca_notices" && c.op === "update") as any
  assert.equal(upd.vals.status, "actioned", "notice still leaves the queue")
})

// #8 (folded in): disable with a missing target piece errors out before writing
// an audit row or marking the notice actioned.
test("actionDmcaNotice: disable when target piece is missing -> error, no audit", async () => {
  currentFake = adminFake({
    notice: { id: "n3", status: "received", target_content_object_id: "cgone" },
    piece: null,
  })
  const r = await dmca.actionDmcaNotice({ id: "n3", decision: "disable" })
  assert.equal(r.success, false)
  assert.equal(currentFake.calls.find((c) => c.table === "moderation_actions"), undefined)
})

// Important #3: the one-counter-per-notice rule is backed by a DB unique
// constraint; a lost concurrency race surfaces as a unique violation, which we
// treat as idempotent success (no error to the loser, no second forward email).
test("fileCounterNotice: unique violation on insert -> idempotent success", async () => {
  sent.length = 0
  currentFake = makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "dmca_notices" && op === "select")
      return {
        data: {
          id: "n1",
          status: "actioned",
          target_content_object_id: "c1",
          complainant_email: "jane@x.test",
        },
      }
    if (table === "content_objects" && op === "select")
      return { data: { author_id: "a1", status: "archived", title: "T" } }
    if (table === "dmca_counter_notices" && op === "select") return { data: null }
    if (table === "dmca_counter_notices" && op === "insert")
      return { error: { code: "23505", message: "duplicate key" } }
    return { data: null, error: null }
  }, "a1")
  const r = await dmca.fileCounterNotice(goodCounter)
  assert.equal(r.success, true, "unique violation treated as idempotent success")
  assert.equal(sent.length, 0, "no second complainant email on the losing race")
})

// #7: admin can reopen a mis-rejected notice (rejected -> received).
test("reopenDmcaNotice: rejected notice returns to the received queue", async () => {
  currentFake = adminFake({ notice: { id: "n1", status: "rejected", target_content_object_id: "c1" } })
  const r = await dmca.reopenDmcaNotice({ id: "n1" })
  assert.equal(r.success, true)
  const upd = currentFake.calls.find((c) => c.table === "dmca_notices" && c.op === "update") as any
  assert.equal(upd.vals.status, "received")
})

test("reopenDmcaNotice: a non-rejected notice is a no-op error", async () => {
  currentFake = adminFake({ notice: { id: "n1", status: "actioned", target_content_object_id: "c1" } })
  const r = await dmca.reopenDmcaNotice({ id: "n1" })
  assert.equal(r.success, false)
  assert.equal(currentFake.calls.find((c) => c.table === "dmca_notices" && c.op === "update"), undefined)
})

// Ruling follow-up: admin matches an unmatched notice to a piece by its URL so
// it becomes actionable in-app (reuses the slug resolver).
test("resolveNoticeTarget: a matching URL sets the notice target", async () => {
  currentFake = adminFake({
    notice: { id: "n1", status: "received", target_content_object_id: null },
    piece: { id: "c9" },
  })
  const r = await dmca.resolveNoticeTarget({ id: "n1", url: "https://mycelium.social/u/j/the-slug" })
  assert.equal(r.success, true)
  const upd = currentFake.calls.find((c) => c.table === "dmca_notices" && c.op === "update") as any
  assert.equal(upd.vals.target_content_object_id, "c9")
})

test("resolveNoticeTarget: no match -> error, notice unchanged", async () => {
  currentFake = adminFake({
    notice: { id: "n1", status: "received", target_content_object_id: null },
    piece: null,
  })
  const r = await dmca.resolveNoticeTarget({ id: "n1", url: "https://mycelium.social/about" })
  assert.equal(r.success, false)
  assert.equal(currentFake.calls.find((c) => c.table === "dmca_notices" && c.op === "update"), undefined)
})

// Important #2: external rightsholders file by URL, not the internal content
// object UUID. With no id supplied, the piece is resolved from the infringing
// URL's slug; an unresolvable URL still captures the notice (null target) for
// admin triage rather than rejecting a valid §512 notice.
test("fileDmcaNotice: no id -> resolves piece from the infringing URL slug", async () => {
  rlOk = true
  currentFake = makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "content_objects" && op === "select") return { data: { id: "c9" } }
    if (table === "dmca_notices" && op === "insert") return { data: { id: "n9" } }
    return { data: null, error: null }
  })
  const r = await dmca.fileDmcaNotice({
    ...goodNotice,
    target_content_object_id: undefined,
    infringing_urls: ["https://mycelium.social/u/jane/my-piece"],
  })
  assert.equal(r.success, true)
  const ins = currentFake.calls.find((c) => c.table === "dmca_notices" && c.op === "insert") as any
  assert.equal(ins.rows.target_content_object_id, "c9", "slug my-piece resolved to content object")
})

test("fileDmcaNotice: no id and unresolvable URL -> captures notice with null target", async () => {
  rlOk = true
  currentFake = makeFakeClient(({ table, op }: ResolveCtx): any => {
    if (table === "content_objects" && op === "select") return { data: null }
    if (table === "dmca_notices" && op === "insert") return { data: { id: "n10" } }
    return { data: null, error: null }
  })
  const r = await dmca.fileDmcaNotice({
    ...goodNotice,
    target_content_object_id: undefined,
    infringing_urls: ["https://mycelium.social/about"],
  })
  assert.equal(r.success, true)
  const ins = currentFake.calls.find((c) => c.table === "dmca_notices" && c.op === "insert") as any
  assert.equal(ins.rows.target_content_object_id, null, "notice captured for admin triage, not rejected")
})

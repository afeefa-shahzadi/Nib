/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { makeFakeClient } from "./fake-supabase"
import { isRateLimitError, drainOutbox } from "@/lib/email-outbox"
import { sendBulkDispatch } from "@/lib/newsletter-send"

process.env.EMAIL_TOKEN_SECRET ??= "test-secret"

const rateErr = Object.assign(new Error("550 5.4.5 Daily user sending limit exceeded"), {
  responseCode: 550,
  response: "550 5.4.5 Daily user sending limit exceeded.",
})

function fakeTransporter(fail: (to: string, n: number) => Error | null) {
  const sent: string[] = []
  let n = 0
  return {
    sent,
    sendMail: async (m: { to: string }) => {
      const e = fail(m.to, n++)
      if (e) throw e
      sent.push(m.to)
      return { messageId: `id-${m.to}` }
    },
  }
}

test("isRateLimitError table", () => {
  const cases: [unknown, boolean][] = [
    [rateErr, true],
    [{ responseCode: 421, response: "421 4.7.0 Try again later, too many connections" }, true],
    [{ responseCode: 454, response: "454 4.7.0 Too many login attempts" }, true],
    [{ responseCode: 452, response: "452 Rate limit exceeded" }, true],
    [{ responseCode: 451, response: "451 quota exceeded" }, true],
    [{ responseCode: 550, response: "550 5.1.1 No such user" }, false],
    [{ responseCode: 535, response: "535 auth failed, limit" }, false],
    [new Error("ECONNRESET"), false],
    [null, false],
  ]
  for (const [e, want] of cases) assert.equal(isRateLimitError(e), want, JSON.stringify(e))
})

test("sendBulkDispatch: rate limit mid-batch queues failed + remaining with future send_after", async () => {
  const db = makeFakeClient(() => ({ error: null }))
  const t = fakeTransporter((_to, n) => (n >= 2 ? rateErr : null))
  const recipients = ["a@x", "b@x", "c@x", "d@x", "e@x"]
  const r = await sendBulkDispatch({
    transporter: t as any,
    from: "f@x",
    subject: "s",
    recipients,
    authorId: "auth1",
    appUrl: "http://app",
    html: (u) => `<a href="${u}">u</a>`,
    concurrency: 1,
    db: db as any,
  })
  assert.equal(r.sent, 2)
  assert.equal(r.queued, 3)
  const rows = db.calls.filter((c) => c.table === "email_outbox").flatMap((c: any) => c.rows)
  assert.deepEqual(rows.map((x: any) => x.to_email), ["c@x", "d@x", "e@x"])
  for (const row of rows) {
    assert.ok(new Date(row.send_after).getTime() > Date.now() + 50 * 60_000)
    assert.match(row.html, /unsubscribe/)
    assert.ok(row.headers["List-Unsubscribe"])
  }
})

test("sendBulkDispatch: non-rate error queues just that one and continues", async () => {
  const db = makeFakeClient(() => ({ error: null }))
  const t = fakeTransporter((to) => (to === "b@x" ? new Error("ECONNRESET") : null))
  const r = await sendBulkDispatch({
    transporter: t as any,
    from: "f@x",
    subject: "s",
    recipients: ["a@x", "b@x", "c@x"],
    authorId: "auth1",
    appUrl: "http://app",
    html: () => "h",
    concurrency: 1,
    db: db as any,
  })
  assert.equal(r.sent, 2)
  assert.equal(r.queued, 1)
  assert.deepEqual(t.sent, ["a@x", "c@x"])
  const rows = db.calls.filter((c) => c.table === "email_outbox").flatMap((c: any) => c.rows)
  assert.deepEqual(rows.map((x: any) => x.to_email), ["b@x"])
})

const row = (id: string, attempts = 0) => ({
  id,
  to_email: `${id}@x`,
  from_email: "f@x",
  subject: "s",
  html: "h",
  headers: {},
  attempts,
})

// Claim RPC returns only the rows it leased; a select of the table must not be used.
const claimDb = (rows: any[]) =>
  makeFakeClient(({ op, table }) =>
    op === "rpc" && table === "claim_email_outbox"
      ? { data: rows, error: null }
      : op === "select"
        ? { data: [row("NOT-CLAIMED")], error: null }
        : { error: null }
  )

test("drainOutbox: sends only rows the claim returns, marks sent_at, prunes old", async () => {
  const db = claimDb([row("r1"), row("r2")])
  const t = fakeTransporter(() => null)
  const r = await drainOutbox(db as any, t as any, 50)
  assert.deepEqual(t.sent, ["r1@x", "r2@x"])
  assert.equal(r.sent, 2)
  const claim = (db.calls as any[]).find((c) => c.op === "rpc" && c.table === "claim_email_outbox")
  assert.deepEqual(claim.args, { n: 50 })
  const ups = (db.calls as any[]).filter((c) => c.op === "update")
  assert.equal(ups.length, 2)
  for (const u of ups) assert.ok(u.vals.sent_at)
  const del = (db.calls as any[]).find((c) => c.op === "delete")
  const cutoff = new Date(del.filters.find((f: any) => f[0] === "lt.sent_at")[1]).getTime()
  assert.ok(Math.abs(cutoff - (Date.now() - 30 * 86_400_000)) < 60_000)
})

test("drainOutbox: rate limit defers failed + remaining via RPC, no attempts consumed", async () => {
  const db = claimDb([row("r1"), row("r2", 5), row("r3")])
  const t = fakeTransporter((to) => (to === "r2@x" ? rateErr : null))
  const r = await drainOutbox(db as any, t as any)
  assert.deepEqual(t.sent, ["r1@x"])
  assert.equal(r.sent, 1)
  assert.equal(r.rescheduled, 2)
  const defer = (db.calls as any[]).find((c) => c.op === "rpc" && c.table === "defer_email_outbox")
  assert.deepEqual(defer.args, { ids: ["r2", "r3"] })
  const ups = (db.calls as any[]).filter((c) => c.op === "update")
  assert.equal(ups.length, 1) // only r1's sent_at
  assert.ok(!ups.some((u) => "attempts" in u.vals))
})

test("drainOutbox: real error counts an attempt; gives up at 72", async () => {
  const db = claimDb([row("r1", 71), row("r2", 3)])
  const t = fakeTransporter(() => new Error("ECONNRESET"))
  const r = await drainOutbox(db as any, t as any)
  assert.equal(r.failed, 2)
  const ups = (db.calls as any[]).filter((c) => c.op === "update")
  assert.equal(ups[0].vals.attempts, 72)
  assert.equal(ups[0].vals.last_error, "gave up")
  assert.equal(ups[1].vals.attempts, 4)
  assert.notEqual(ups[1].vals.last_error, "gave up")
})

test("sendBulkDispatch concurrency 8: every recipient is exactly one of sent/queued", async () => {
  const db = makeFakeClient(() => ({ error: null }))
  const t = fakeTransporter((_to, n) => (n >= 5 ? rateErr : null))
  const recipients = Array.from({ length: 30 }, (_, k) => `u${k}@x`)
  const r = await sendBulkDispatch({
    transporter: t as any, from: "f@x", subject: "s", recipients,
    authorId: "auth1", appUrl: "http://app", html: () => "h", concurrency: 8, db: db as any,
  })
  const queued = db.calls.filter((c) => c.table === "email_outbox").flatMap((c: any) => c.rows.map((x: any) => x.to_email))
  const all = [...t.sent, ...queued]
  assert.equal(all.length, recipients.length)
  assert.deepEqual(new Set(all), new Set(recipients))
  assert.equal(r.sent + r.queued, recipients.length)
  assert.equal(r.lost, 0)
})

test("sendBulkDispatch: failed enqueue is surfaced as lost, not queued", async () => {
  const db = makeFakeClient(({ op }) => (op === "insert" ? { error: { message: "db down" } } : { error: null }))
  const t = fakeTransporter((_to, n) => (n >= 1 ? rateErr : null))
  const r = await sendBulkDispatch({
    transporter: t as any, from: "f@x", subject: "s", recipients: ["a@x", "b@x", "c@x"],
    authorId: "auth1", appUrl: "http://app", html: () => "h", concurrency: 1, db: db as any,
  })
  assert.equal(r.sent, 1)
  assert.equal(r.queued, 0)
  assert.equal(r.lost, 2)
})

test("vercel.json: no cron more frequent than daily", () => {
  const { crons } = JSON.parse(readFileSync("vercel.json", "utf8"))
  for (const c of crons) {
    const [min, hour] = c.schedule.split(" ")
    assert.match(min, /^\d+$/, c.path)
    assert.match(hour, /^\d+$/, c.path)
  }
})

/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  validateNotice,
  validateCounterNotice,
  addBusinessDays,
  restoreEligibleAt,
  type NoticeInput,
  type CounterNoticeInput,
} from "@/lib/dmca/validate"

const goodNotice: NoticeInput = {
  notice_type: "dmca",
  target_content_object_id: "11111111-1111-1111-1111-111111111111",
  complainant_name: "Jane Rights",
  complainant_email: "jane@example.com",
  complainant_address: "1 Main St, City",
  complainant_role: "owner",
  work_identification: "My novel, 2024",
  infringing_urls: ["https://mycelium.test/u/bob/stolen"],
  good_faith_statement: true,
  accuracy_statement: true,
  signature: "Jane Rights",
}

test("validateNotice: a complete notice passes", () => {
  assert.deepEqual(validateNotice(goodNotice), { ok: true })
})

test("validateNotice: no target id is accepted (resolved from URL server-side)", () => {
  assert.deepEqual(validateNotice({ ...goodNotice, target_content_object_id: undefined }), {
    ok: true,
  })
})

test("validateNotice: a false sworn statement is rejected", () => {
  const r = validateNotice({ ...goodNotice, accuracy_statement: false })
  assert.equal(r.ok, false)
  if (!r.ok) assert.ok(r.errors.accuracy_statement)
})

test("validateNotice: malformed email rejected", () => {
  const r = validateNotice({ ...goodNotice, complainant_email: "not-an-email" })
  assert.equal(r.ok, false)
  if (!r.ok) assert.ok(r.errors.complainant_email)
})

test("validateNotice: missing name/address/work/signature rejected", () => {
  const r = validateNotice({
    ...goodNotice,
    complainant_name: "  ",
    complainant_address: "",
    work_identification: "",
    signature: "",
  })
  assert.equal(r.ok, false)
  if (!r.ok) {
    assert.ok(r.errors.complainant_name)
    assert.ok(r.errors.complainant_address)
    assert.ok(r.errors.work_identification)
    assert.ok(r.errors.signature)
  }
})

test("validateNotice: empty infringing_urls rejected", () => {
  const r = validateNotice({ ...goodNotice, infringing_urls: ["  "] })
  assert.equal(r.ok, false)
  if (!r.ok) assert.ok(r.errors.infringing_urls)
})

test("validateNotice: bad enum values rejected", () => {
  const r = validateNotice({
    ...goodNotice,
    notice_type: "x" as any,
    complainant_role: "y" as any,
  })
  assert.equal(r.ok, false)
})

const goodCounter: CounterNoticeInput = {
  notice_id: "22222222-2222-2222-2222-222222222222",
  statement: "I own this work.",
  consent_jurisdiction: true,
  good_faith: true,
  signature: "Bob Author",
  contact: "Bob, 2 Side St, phone 555",
}

test("validateCounterNotice: complete passes; false booleans rejected", () => {
  assert.deepEqual(validateCounterNotice(goodCounter), { ok: true })
  const r = validateCounterNotice({ ...goodCounter, consent_jurisdiction: false })
  assert.equal(r.ok, false)
})

test("addBusinessDays: skips weekends", () => {
  // 2026-01-01 is a Thursday; +10 business days = Thursday 2026-01-15.
  const from = new Date("2026-01-01T00:00:00.000Z")
  assert.equal(addBusinessDays(from, 10).toISOString().slice(0, 10), "2026-01-15")
})

test("restoreEligibleAt: default 10 business days, ISO string", () => {
  const iso = restoreEligibleAt(new Date("2026-01-01T00:00:00.000Z"))
  assert.equal(iso.slice(0, 10), "2026-01-15")
})

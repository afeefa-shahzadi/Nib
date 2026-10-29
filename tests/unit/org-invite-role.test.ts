/* eslint-disable @typescript-eslint/no-explicit-any */
// Org invites now write through the service role, so the invite role must be
// whitelisted in code: an admin must not be able to mint an owner.
import { test, before, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient } from "./fake-supabase"

let fake: ReturnType<typeof makeFakeClient>
mock.module("@/lib/supabase/server", {
  namedExports: {
    createAdminClient: async () => fake,
    createClient: async () => fake,
    createServiceRoleClient: async () => fake,
  },
})
mock.module("next/cache", {
  namedExports: { revalidatePath: () => {}, unstable_noStore: () => {} },
})

let orgs: typeof import("@/actions/orgs")
before(async () => {
  orgs = await import("@/actions/orgs")
})

const asAdmin = () =>
  makeFakeClient(({ table, op }) =>
    table === "org_members" && op === "select" ? { data: { role: "admin" } } : { error: null }
  )

test("inviteToOrg never stores an owner invite", async () => {
  fake = asAdmin()
  await orgs.inviteToOrg({ data: { org_id: "o1", email: "X@Y.co", role: "owner" } })
  const row = (fake.calls.find((c) => c.table === "org_invites") as any).rows
  assert.equal(row.role, "member")
  assert.equal(row.invited_by, "u1")
})

test("bulkInviteMembers keeps admin, downgrades anything else", async () => {
  fake = asAdmin()
  await orgs.bulkInviteMembers({ data: { org_id: "o1", emails: ["a@b.co"], role: "admin" } })
  await orgs.bulkInviteMembers({ data: { org_id: "o1", emails: ["c@d.co"], role: "owner" } })
  const rows = fake.calls.filter((c) => c.table === "org_invites").map((c: any) => c.rows[0].role)
  assert.deepEqual(rows, ["admin", "member"])
})

import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient } from "./fake-supabase"

mock.module("@/lib/supabase/server", {
  namedExports: {
    createServiceRoleClient: async () => makeFakeClient(() => ({ data: [] })),
    createAdminClient: async () => makeFakeClient(() => ({ data: [] })),
    createClient: async () => makeFakeClient(() => ({ data: [] })),
  },
})

test("boost_1 is not an author quest (boosts are parked)", async () => {
  const q = await import("@/lib/quests.server")
  assert.ok(!(q.AUTHOR_QUESTS as string[]).includes("boost_1"))
  assert.ok(!("boost_1" in q.QUEST_POINTS))
})

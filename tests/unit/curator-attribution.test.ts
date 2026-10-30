import { test } from "node:test"
import assert from "node:assert/strict"
import { resolveCuratorAttribution } from "@/lib/curator-attribution"

type Rows = { collections?: object | null; collection_items?: object | null; content_objects?: object | null }

// Minimal stand-in: each table's maybeSingle() resolves to the row given.
function db(rows: Rows) {
  return {
    from(table: keyof Rows) {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: rows[table] ?? null }),
      }
      return q
    },
  } as never
}

const ok: Rows = {
  collections: { curator_id: "cur", is_public: true },
  collection_items: { id: "i1" },
  content_objects: { author_id: "auth", curator_share_enabled: true },
}
const base = { collectionId: "c1", contentObjectId: "p1", authorId: "auth", buyerId: "buyer" }

test("valid referral returns the curator", async () => {
  assert.deepEqual(await resolveCuratorAttribution(db(ok), base), { collectionId: "c1", curatorId: "cur" })
})

test("no collection id means no curator", async () => {
  assert.equal(await resolveCuratorAttribution(db(ok), { ...base, collectionId: null }), null)
})

test("author has not opted in", async () => {
  assert.equal(await resolveCuratorAttribution(db({ ...ok, content_objects: { author_id: "auth", curator_share_enabled: false } }), base), null)
})

test("private collection", async () => {
  assert.equal(await resolveCuratorAttribution(db({ ...ok, collections: { curator_id: "cur", is_public: false } }), base), null)
})

test("piece is not in the collection", async () => {
  assert.equal(await resolveCuratorAttribution(db({ ...ok, collection_items: null }), base), null)
})

test("curator cannot be the author or the buyer", async () => {
  assert.equal(await resolveCuratorAttribution(db({ ...ok, collections: { curator_id: "auth", is_public: true } }), base), null)
  assert.equal(await resolveCuratorAttribution(db({ ...ok, collections: { curator_id: "buyer", is_public: true } }), base), null)
})

test("author id must match the piece's author", async () => {
  assert.equal(await resolveCuratorAttribution(db(ok), { ...base, authorId: "someone-else" }), null)
})

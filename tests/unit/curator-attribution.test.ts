import { test } from "node:test"
import assert from "node:assert/strict"
import { resolveCuratorAttribution } from "@/lib/curator-attribution"

type Rows = {
  collections?: object | null
  collection_items?: object | null
  content_objects?: object | null
  bundles?: object | null
  bundle_items?: object[] | null
}

// Minimal stand-in: maybeSingle() resolves to the row given; awaiting the chain
// resolves to it as a list (the bundle path reads lists).
function db(rows: Rows) {
  return {
    from(table: keyof Rows) {
      const row = rows[table] ?? null
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        maybeSingle: async () => ({ data: row }),
        then: (ok: (r: { data: unknown }) => unknown) =>
          ok({ data: Array.isArray(row) ? row : row ? [row] : [] }),
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

// ---------- bundles: curated when the collection holds an opted-in piece of the bundle ----------

const bundleOk: Rows = {
  collections: { curator_id: "cur", is_public: true },
  bundles: { author_id: "auth" },
  bundle_items: [{ content_object_id: "p1" }, { content_object_id: "p2" }],
  collection_items: [{ content_object_id: "p2" }],
  content_objects: [{ id: "p2", author_id: "auth", curator_share_enabled: true }],
}
const bundleBase = { collectionId: "c1", bundleId: "b1", authorId: "auth", buyerId: "buyer" }

test("bundle sale from a collection holding one of its opted-in pieces pays the curator", async () => {
  assert.deepEqual(await resolveCuratorAttribution(db(bundleOk), bundleBase), { collectionId: "c1", curatorId: "cur" })
})

test("bundle: no overlap between bundle and collection", async () => {
  assert.equal(await resolveCuratorAttribution(db({ ...bundleOk, collection_items: [] }), bundleBase), null)
})

test("bundle: overlapping piece not opted in", async () => {
  assert.equal(await resolveCuratorAttribution(db({ ...bundleOk, content_objects: [] }), bundleBase), null)
})

test("bundle: bundle belongs to someone else", async () => {
  assert.equal(await resolveCuratorAttribution(db({ ...bundleOk, bundles: { author_id: "x" } }), bundleBase), null)
})

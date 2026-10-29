import { test } from "node:test"
import assert from "node:assert/strict"
import { getSchema } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import { MentionNode } from "@/components/composer/extensions/mention-node"

const schema = getSchema([StarterKit, MentionNode])

test("a saved @mention / [[link]] carries its label text", () => {
  const node = schema.nodes.mention.create({ id: "p1", label: "Ada Lovelace", href: "/u/ada" })
  const spec = node.type.spec.toDOM!(node) as unknown as [string, Record<string, string>, ...unknown[]]
  assert.equal(spec[0], "a")
  assert.equal(spec[1].href, "/u/ada")
  assert.equal(spec[1]["data-type"], "mention")
  assert.ok(spec.slice(2).includes("Ada Lovelace"), `label text missing: ${JSON.stringify(spec)}`)
})

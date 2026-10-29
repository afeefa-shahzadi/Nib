import { test } from "node:test"
import assert from "node:assert/strict"
import { nextNodeId } from "@/components/composer/flowchart-ids"

test("new flowchart node ids continue after the highest existing one", () => {
  assert.equal(nextNodeId([]), "dndnode_0")
  assert.equal(
    nextNodeId([{ id: "dndnode_0" }, { id: "dndnode_7" }, { id: "custom" }, { id: "dndnode_3" }]),
    "dndnode_8"
  )
})

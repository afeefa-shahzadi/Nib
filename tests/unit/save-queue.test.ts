import { test } from "node:test"
import assert from "node:assert/strict"
import { createSaveQueue } from "@/components/composer/save-queue"

const tick = () => new Promise((r) => setTimeout(r, 5))

test("idle() waits for the save in flight (schedule/publish must not outrun it)", async () => {
  const q = createSaveQueue()
  let release!: () => void
  let saved = false
  void q.enqueue(async () => {
    await new Promise<void>((r) => (release = r))
    saved = true
  })
  await tick()
  let idle = false
  const p = q.idle().then(() => (idle = true))
  await tick()
  assert.equal(idle, false)
  release()
  await p
  assert.equal(saved, true)
})

test("a save queued before a version restore never posts; the in-flight one finishes first", async () => {
  const q = createSaveQueue()
  const posted: string[] = []
  let releaseA!: () => void
  const aDone = new Promise<void>((r) => (releaseA = r))

  // A is in flight, B (pre-restore blocks) is queued behind it.
  void q.enqueue(async () => {
    await aDone
    posted.push("A")
  })
  await tick() // A has started (request on the wire)
  void q.enqueue(async () => {
    posted.push("B-stale")
  })

  let restoreStarted = false
  const begin = q.beginRestore().then(() => (restoreStarted = true))
  await tick()
  assert.equal(restoreStarted, false, "restore must wait for the in-flight save")
  releaseA()
  await begin
  await tick()
  assert.deepEqual(posted, ["A"], "the queued pre-restore save must be dropped")

  // While the restore runs, nothing saves.
  assert.equal(q.paused, true)
  await q.enqueue(async () => {
    posted.push("during")
  })
  assert.deepEqual(posted, ["A"])

  q.endRestore()
  await q.enqueue(async () => {
    posted.push("after")
  })
  assert.deepEqual(posted, ["A", "after"])
})

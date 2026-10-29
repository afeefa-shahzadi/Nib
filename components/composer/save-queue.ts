// Serializes block autosaves and fences them around a version restore.
// A save queued before the restore holds the pre-restore blocks; posting it
// after the restore would prune every restored row. beginRestore() waits for
// the save already in flight, drops anything still queued (generation bump),
// and pauses new saves until endRestore().
export function createSaveQueue() {
  let chain: Promise<void> = Promise.resolve()
  let gen = 0
  let paused = false
  return {
    get paused() {
      return paused
    },
    enqueue(run: () => Promise<void>): Promise<void> {
      const mine = gen
      chain = chain
        .then(() => (mine === gen && !paused ? run() : undefined))
        .catch(() => {})
      return chain
    },
    async beginRestore() {
      paused = true
      gen++
      await chain
    },
    endRestore() {
      paused = false
    },
    /** Resolves once every save queued so far has settled. */
    idle(): Promise<void> {
      return chain
    },
  }
}

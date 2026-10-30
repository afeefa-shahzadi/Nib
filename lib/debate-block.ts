export const DEBATE_BLOCK_EVENT = "nib:debate-block"

/** Opens a debate room's composer about one paragraph of the piece. */
export function debateBlock(roomId: string, blockId: string) {
  document.getElementById("live-debates")?.scrollIntoView({ behavior: "smooth" })
  window.dispatchEvent(new CustomEvent(DEBATE_BLOCK_EVENT, { detail: { roomId, blockId } }))
}

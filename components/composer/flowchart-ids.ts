// Next free `dndnode_N` id. A module-level counter restarted at 0 on every page
// load, so a node added to a saved flowchart reused an existing id and React
// Flow merged/mis-wired the two.
export function nextNodeId(nodes: { id: string }[]): string {
  let max = -1
  for (const n of nodes) {
    const m = /^dndnode_(\d+)$/.exec(n.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `dndnode_${max + 1}`
}

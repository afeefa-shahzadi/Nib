/** Resolve a theme token (e.g. "--success") to an rgb() string for canvas libraries that can't read CSS vars. Client only. */
export function cssColor(name: string): string {
  const c = document.createElement("canvas").getContext("2d")!
  c.fillStyle = "black"
  c.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "black"
  c.fillRect(0, 0, 1, 1)
  const [r, g, b] = c.getImageData(0, 0, 1, 1).data
  return `rgb(${r}, ${g}, ${b})`
}

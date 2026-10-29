import { ImageResponse } from "next/og"

// PNG share card (1200×630). Social unfurlers (WhatsApp, LinkedIn, X) don't render SVG.
export function wrap(s: string, maxChars: number, maxLines: number): string[] {
  const words = s.split(/\s+/)
  const lines: string[] = []
  let line = ""
  for (const w of words) {
    if ((line + " " + w).trim().length > maxChars) {
      if (line) lines.push(line)
      line = w
      if (lines.length >= maxLines) break
    } else {
      line = (line + " " + w).trim()
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S+$/, "") + "…"
  }
  return lines
}

export function ogCard({ title, subtitle, footer }: { title: string; subtitle?: string | null; footer: string }) {
  const titleLines = wrap(title, 32, 3)
  const subLines = subtitle ? wrap(subtitle, 60, 2) : []
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f8f4ec", padding: "72px 80px", borderLeft: "12px solid #2f5196" }}>
        <div style={{ display: "flex", fontSize: 30, color: "#2f5196", letterSpacing: 2 }}>nib</div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 56, flexGrow: 1 }}>
          {titleLines.map((l, i) => (
            <div key={i} style={{ display: "flex", fontSize: 68, fontWeight: 700, color: "#1c1a17", lineHeight: 1.12 }}>{l}</div>
          ))}
          {subLines.map((l, i) => (
            <div key={`s${i}`} style={{ display: "flex", fontSize: 28, color: "#6b655c", marginTop: i === 0 ? 28 : 4 }}>{l}</div>
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#2f5196" }}>{footer}</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } }
  )
}

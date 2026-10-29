import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const css = readFileSync("app/globals.css", "utf-8").replace(/\r\n/g, "\n")

function block(sel: string) {
  const esc = sel.replace(".", String.raw`\.`)
  const m = css.match(new RegExp(String.raw`(?:^|\n)${esc}\s*\{([^}]*)\}`))
  assert.ok(m, `no ${sel} block`)
  return m![1]
}
function token(b: string, name: string) {
  const m = b.match(new RegExp(String.raw`--${name}:\s*oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)`))
  assert.ok(m, `no --${name}`)
  return m!.slice(1).map(Number) as [number, number, number]
}
function luminance([L, C, h]: [number, number, number]) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, v)))
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}
function contrast(a: [number, number, number], b: [number, number, number]) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

for (const sel of [":root", ".dark"]) {
  test(`${sel} text tokens meet AA (4.5:1)`, () => {
    const b = block(sel)
    const bg = token(b, "background")
    assert.ok(contrast(token(b, "foreground"), bg) >= 4.5, "foreground")
    assert.ok(contrast(token(b, "muted-foreground"), bg) >= 4.5, "muted-foreground/background")
    assert.ok(contrast(token(b, "primary-foreground"), token(b, "primary")) >= 4.5, "primary-foreground/primary")
    assert.ok(contrast(token(b, "primary"), bg) >= 3, "primary/background (non-text 3:1)")
    for (const t of ["note", "warn", "info", "success"]) {
      for (const surf of ["background", "card", "muted"])
        assert.ok(contrast(token(b, t), token(b, surf)) >= 4.5, `${t}/${surf}`)
      token(b, `${t}-foreground`)
    }
  })
}

// Accent themes: [data-accent] overrides only the accent group; ink repeats the :root/.dark default.
function rawBlock(sel: string) {
  const i = css.indexOf(`\n${sel} {`)
  assert.ok(i >= 0, `no ${sel} block`)
  return css.slice(i, css.indexOf("}", i))
}
const ACCENT_TOKENS = ["primary", "ring", "chart-1", "sidebar-primary", "sidebar-ring"]
for (const accent of ["ink", "oxblood", "teal"]) {
  for (const [mode, base, over] of [
    ["light", ":root", `[data-accent="${accent}"]`],
    ["dark", ".dark", `.dark[data-accent="${accent}"]`],
  ] as const) {
    test(`accent ${accent} × ${mode} passes AA`, () => {
      const b = block(base)
      const o = rawBlock(over)
      for (const t of ACCENT_TOKENS) token(o, t)
      const pick = (n: string) => (new RegExp(`--${n}:`).test(o) ? token(o, n) : token(b, n))
      const bg = token(b, "background")
      assert.ok(contrast(pick("primary-foreground"), pick("primary")) >= 4.5, "primary-foreground/primary")
      assert.ok(contrast(pick("primary"), bg) >= 4.5, "primary text/background")
    })
  }
}

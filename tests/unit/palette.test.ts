import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { ALLOWLIST } from "./palette-allowlist"

const HUES = "amber|rose|blue|zinc|red|green|yellow|orange|purple|pink|sky|emerald|teal|indigo|violet|cyan|lime|fuchsia|slate|gray|neutral|stone"
const PFX = "text|bg|border|ring|fill|stroke|from|to|via|divide|outline|decoration|shadow|placeholder|caret|accent|ring-offset|inset-ring"
const RAW = new RegExp(
  [
    String.raw`\b(?:${PFX})-(?:${HUES})-\d{2,3}`, // raw hue utilities
    String.raw`\b(?:${PFX})-(?:white|black)\b`, // white/black utilities
    String.raw`\[(?:#[0-9a-fA-F]{3,8}|rgba?\()`, // arbitrary-value colours
    String.raw`(?<![&\w])#[0-9a-fA-F]{6}\b`, // 6-digit hex literals
    String.raw`(?<![&\w])#[0-9a-fA-F]{3}(?=["'\x60\s)\]])`, // 3-digit hex literals
    String.raw`\b(?:rgba?|hsla?)\(\s*\d`, // rgb()/hsl() literals
  ].join("|"),
  "g",
)

function walk(d: string, out: string[] = []) {
  for (const n of readdirSync(d)) {
    const p = join(d, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(n)) out.push(p.split("\\").join("/"))
  }
  return out
}

test("no raw colours in app/ or components/ (use tokens)", () => {
  const bad: string[] = []
  for (const f of [...walk("app"), ...walk("components"), ...walk("lib"), ...walk("actions")]) {
    if (ALLOWLIST[f]) continue
    const m = readFileSync(f, "utf-8").match(RAW)
    if (m) bad.push(`${f}: ${[...new Set(m)].join(", ")}`)
  }
  assert.deepEqual(bad, [])
})

test("allowlist entries carry a reason", () => {
  for (const [f, why] of Object.entries(ALLOWLIST)) assert.ok(why.length > 10, f)
})

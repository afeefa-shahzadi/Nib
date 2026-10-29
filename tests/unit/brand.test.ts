import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

function walk(d: string, out: string[] = []) {
  for (const n of readdirSync(d)) {
    const p = join(d, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|css)$/.test(n)) out.push(p.split("\\").join("/"))
  }
  return out
}
const files = [...walk("app"), ...walk("components"), ...walk("lib"), ...walk("actions"), ...walk("emails"), ...walk("hooks")]

test("no user-facing 'Mycelium' brand strings left", () => {
  const bad = files.filter((f) => /\b(Mycelium|MYCELIUM)\b/.test(readFileSync(f, "utf-8")))
  assert.deepEqual(bad, [])
})

test("no hardcoded mycelium.* hosts", () => {
  const bad = files.filter((f) => /mycelium\.[a-z]{2,}/i.test(readFileSync(f, "utf-8")))
  assert.deepEqual(bad, [])
})

test("legal contacts and email From use CONTACT_EMAIL", async () => {
  const { CONTACT_EMAIL, BRAND_NAME } = await import("../../lib/brand")
  assert.equal(BRAND_NAME, "Nib")
  assert.equal(CONTACT_EMAIL, process.env.CONTACT_EMAIL ?? "writeson.nib@gmail.com")
  const text = (o: unknown) => JSON.stringify(o)
  const { SECTIONS: TERMS_SECTIONS } = await import("../../lib/content/terms/data")
  const { SECTIONS: PRIVACY_SECTIONS } = await import("../../lib/content/privacy/data")
  assert.match(text(TERMS_SECTIONS), new RegExp(CONTACT_EMAIL.replace(".", "\.")))
  assert.match(text(PRIVACY_SECTIONS), new RegExp(CONTACT_EMAIL.replace(".", "\.")))
  const { DMCA_AGENT, GRIEVANCE_OFFICER } = await import("../../lib/legal/contacts")
  assert.equal(DMCA_AGENT.email, CONTACT_EMAIL)
  assert.equal(GRIEVANCE_OFFICER.email, CONTACT_EMAIL)
})

test("footer social icons come only from env vars", () => {
  const src = readFileSync("components/site-chrome.tsx", "utf-8")
  assert.doesNotMatch(src, /(twitter|x|github|linkedin|instagram|youtube)\.com\//)
  for (const v of ["X", "GITHUB", "LINKEDIN", "INSTAGRAM", "YOUTUBE"])
    assert.match(src, new RegExp(`NEXT_PUBLIC_SOCIAL_${v}(?![A-Z_])`))
})

import { test } from "node:test"
import assert from "node:assert/strict"
import { normalizeLink, normalizeLinks, linkLabel } from "@/lib/profile-links"

test("adds https and trims", () => {
  assert.equal(normalizeLink("  example.com/me "), "https://example.com/me")
  assert.equal(normalizeLink("http://example.com"), "https://example.com/")
})

test("empty means no link", () => {
  assert.equal(normalizeLink(""), null)
  assert.equal(normalizeLink(undefined), null)
})

test("rejects non-web schemes, bare words and very long urls", () => {
  for (const v of ["javascript:alert(1)", "data:text/html,x", "ftp://x.com", "not a url", "localhost", "https://" + "a".repeat(300) + ".com"])
    assert.throws(() => normalizeLink(v), v)
})

test("list keeps up to 5 unique links, drops blanks", () => {
  const out = normalizeLinks(["x.com/a", "", "x.com/a", "github.com/b", "a.io", "b.io", "c.io", "d.io"])
  assert.deepEqual(out, ["https://x.com/a", "https://github.com/b", "https://a.io/", "https://b.io/", "https://c.io/"])
})

test("labels known sites by name, others by host", () => {
  assert.equal(linkLabel("https://x.com/nib"), "X")
  assert.equal(linkLabel("https://www.linkedin.com/in/nib"), "LinkedIn")
  assert.equal(linkLabel("https://github.com/nib"), "GitHub")
  assert.equal(linkLabel("https://www.nibwrites.com/"), "nibwrites.com")
})

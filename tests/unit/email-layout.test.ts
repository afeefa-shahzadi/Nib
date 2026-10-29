import { test } from "node:test"
import assert from "node:assert/strict"
import { fromName, nibButton, nibLayout } from "../../lib/email-layout"

test("fromName drops quotes, backslashes and line breaks but keeps letters", () => {
  assert.equal(fromName('Ra"ri \\ O\'Neil\r\nBcc: x'), "Rari  O'NeilBcc: x")
})

test("nibLayout wraps the body in the Nib frame with wordmark and footer", () => {
  const html = nibLayout("<p>Hello</p>", { preview: "Hi <there>", footer: "Why you got this." })
  assert.match(html, /^<!doctype html>/i)
  assert.ok(html.includes("<p>Hello</p>"), "body kept as-is")
  assert.match(html, />nib</, "lowercase wordmark")
  assert.ok(html.includes("Hi &lt;there&gt;"), "preview escaped")
  assert.ok(html.includes("Why you got this."), "footer shown")
})

test("nibButton escapes label and url", () => {
  const b = nibButton(`Read "it"`, `https://x.test/?a=1&b=<2>`)
  assert.ok(b.includes("&amp;b=&lt;2&gt;"))
  assert.ok(b.includes("Read &quot;it&quot;"))
})

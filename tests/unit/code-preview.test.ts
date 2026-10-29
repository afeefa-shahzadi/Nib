import { test } from "node:test"
import assert from "node:assert/strict"
import { isWebBlock, buildSrcDoc } from "@/components/code-preview"

const html = { name: "index.html", content: "<p>hi</p>", lang: "html" }
const css = { name: "style.css", content: "p{color:red}", lang: "css" }
const js = { name: "main.js", content: "console.log(1)", lang: "javascript" }

test("a block is a web page only when it has HTML or CSS", () => {
  assert.equal(isWebBlock([html, css, js]), true)
  assert.equal(isWebBlock([css]), true)
  // JS alone is a program for Run, not a page.
  assert.equal(isWebBlock([js]), false)
  assert.equal(isWebBlock([{ name: "main.ts", content: "", lang: "typescript" }]), false)
})

test("srcdoc forwards console output to the parent before user code runs", () => {
  const doc = buildSrcDoc([html, js])
  const bridge = doc.indexOf("postMessage")
  assert.ok(bridge > -1, "console bridge missing")
  assert.ok(bridge < doc.indexOf("console.log(1)"), "bridge must load before user JS")
})

test("console bridge is also injected into a full HTML document", () => {
  const full = { name: "index.html", lang: "html", content: "<!doctype html><html><head></head><body></body></html>" }
  assert.ok(buildSrcDoc([full, js]).includes("postMessage"))
})

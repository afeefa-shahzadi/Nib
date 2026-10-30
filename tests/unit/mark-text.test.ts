import { test } from "node:test"
import assert from "node:assert/strict"
import { markText } from "@/lib/mark-text"

const wrap = (t: string) => `<mark>${t}</mark>`

test("plain match", () => {
  assert.equal(markText("a quick fox", "quick", wrap), "a <mark>quick</mark> fox")
})

test("a whole paragraph selected across bold text", () => {
  const html = "Short version: <strong>during launch, it's free.</strong> No card."
  const out = markText(html, "Short version: during launch, it's free. No card.", wrap)
  assert.equal(out, "<mark>Short version: </mark><strong><mark>during launch, it's free.</mark></strong><mark> No card.</mark>")
})

test("whitespace and entities differ from the selection", () => {
  assert.equal(markText("we&#39;d   rather\nnot", "we'd rather not", wrap), "<mark>we&#39;d   rather\nnot</mark>")
  assert.equal(markText("Q&amp;A time", "Q&A time", wrap), "<mark>Q&amp;A time</mark>")
})

test("no match leaves the html alone", () => {
  assert.equal(markText("hello", "bye", wrap), "hello")
  assert.equal(markText("hello", "", wrap), "hello")
})

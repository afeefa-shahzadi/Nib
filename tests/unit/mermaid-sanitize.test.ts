import { test } from "node:test"
import assert from "node:assert/strict"
import { sanitizeMermaidSvg } from "@/components/reader/sanitize-mermaid-svg"

// Shape of mermaid's flowchart output: labels live in foreignObject HTML.
const FLOWCHART = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><g class="node"><rect width="80" height="30"></rect><g class="label"><foreignObject width="60" height="20"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell;"><span class="nodeLabel"><p>Start here</p></span></div></foreignObject></g></g><g class="edgeLabel"><foreignObject width="30" height="20"><div xmlns="http://www.w3.org/1999/xhtml"><span class="edgeLabel"><img src="x" onerror="alert(1)">yes</span></div></foreignObject></g><script>alert(2)</script></svg>`

test("sanitized flowchart SVG keeps label text and drops handlers/scripts", () => {
  const out = sanitizeMermaidSvg(FLOWCHART)
  assert.match(out, /Start here/)
  assert.match(out, /yes/)
  assert.doesNotMatch(out, /onerror/i)
  assert.doesNotMatch(out, /<script/i)
  assert.doesNotMatch(out, /alert/)
})

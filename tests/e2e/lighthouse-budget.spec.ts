import { test, expect } from "@playwright/test"
import { spawnSync } from "node:child_process"

// Lighthouse budget gate (Task 25). Needs a PRODUCTION server, not `next dev`:
//   pnpm build && pnpm start -p 3100
//   LH_BASE_URL=http://localhost:3100 npx playwright test lighthouse-budget --workers=1 --project=chromium
// Budgets live in scripts/lighthouse-audit.mjs. Default = A11y/BP/SEO >= 95, desktop perf >= 95, CLS < 0.1,
// plus regression FLOORS for mobile perf/LCP/TBT (and /studio/analytics desktop perf). LH_STRICT=1 enforces
// the real budget (mobile perf 85, LCP 2.5s, TBT 200ms). Per-route JSON lands in LH_OUT.
test.skip(!process.env.LH_BASE_URL, "set LH_BASE_URL to a production server to run the Lighthouse gate")

test("every audited route meets the Lighthouse budget", async () => {
  test.setTimeout(60 * 60_000)
  const out = process.env.LH_OUT || "test-results/lighthouse"
  const r = spawnSync("node", ["scripts/lighthouse-audit.mjs", out], {
    encoding: "utf8",
    env: process.env,
  })
  const rows = (r.stdout || "").split("\n").filter((l) => l.includes("\t"))
  const bad = rows.filter((l) => !l.endsWith("\tok"))
  expect(bad, `routes under budget:\n${bad.join("\n")}`).toEqual([])
  expect(r.status, r.stderr).toBe(0)
})

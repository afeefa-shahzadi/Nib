/* eslint-disable @typescript-eslint/no-explicit-any */
// Regression tests for the docs-audit app bugs (Task 15).
import { test, before, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import { makeFakeClient, ResolveCtx } from "./fake-supabase"

let currentFake: ReturnType<typeof makeFakeClient>

mock.module("@/lib/supabase/server", {
  namedExports: {
    createAdminClient: async () => currentFake,
    createClient: async () => currentFake,
    createServiceRoleClient: async () => currentFake,
  },
})
mock.module("next/cache", { namedExports: { revalidatePath: () => {}, updateTag: () => {} } })

const savedLaunch = process.env.LAUNCH_FREE
const env = process.env as Record<string, string | undefined>
const savedNodeEnv = env.NODE_ENV
beforeEach(() => {
  delete process.env.LAUNCH_FREE
  currentFake = makeFakeClient(() => ({ data: null }))
})
afterEach(() => {
  if (savedLaunch === undefined) delete process.env.LAUNCH_FREE
  else process.env.LAUNCH_FREE = savedLaunch
  env.NODE_ENV = savedNodeEnv
})

let debate: typeof import("@/actions/debate")
before(async () => {
  debate = await import("@/actions/debate")
})

// 1 ---------------------------------------------------------------- feed.xml
test("feed.xml links use the author handle", async () => {
  currentFake = makeFakeClient(
    (): any => ({
      data: [
        {
          title: "Hello",
          summary: "s",
          slug: "hello",
          published_at: "2026-01-01T00:00:00Z",
          profiles: { handle: "creator_demo", display_name: "Creator Demo" },
        },
      ],
    })
  )
  const { GET } = await import("@/app/feed.xml/route")
  const xml = await (await GET()).text()
  assert.match(xml, /\/u\/creator_demo\/hello/)
  assert.doesNotMatch(xml, /undefined/)
})

// 4 -------------------------------------------------------- members debate room
const membersRoom = {
  id: "m1",
  is_public: false,
  access_mode: "members",
  created_by: "author1",
  org_id: null,
  required_tier_id: null,
}
function roomsFake(userId: string | null, hasMembership: boolean) {
  return makeFakeClient((ctx: ResolveCtx): any => {
    if (ctx.table === "debate_rooms") return { data: [membersRoom] }
    if (ctx.table === "memberships") {
      const author = ctx.filters.find(([c]) => c === "author_id")?.[1]
      return { data: hasMembership && author === "author1" ? { id: "mem" } : null }
    }
    return { data: null }
  }, userId)
}
const list = () => debate.listRoomsForPiece({ data: { content_object_id: "c1" } })

test("members debate room: signed-in user sees it under launch, anon never", async () => {
  currentFake = roomsFake("u1", false)
  assert.deepEqual(((await list()) as any[]).map((r) => r.id), ["m1"])
  currentFake = roomsFake(null, false)
  assert.deepEqual(await list(), [])
})

test("members debate room: needs an active membership with the author when off", async () => {
  process.env.LAUNCH_FREE = "0"
  currentFake = roomsFake("u1", true)
  assert.deepEqual(((await list()) as any[]).map((r) => r.id), ["m1"])
  currentFake = roomsFake("u1", false)
  assert.deepEqual(await list(), [])
  currentFake = roomsFake(null, true)
  assert.deepEqual(await list(), [])
})

// 6 ------------------------------------------------------------------- export
test("export keeps image URLs and code language", async () => {
  const { blocksToMarkdown } = await import("@/lib/export/markdown")
  const md = blocksToMarkdown("T", [
    { type: "image", position: 0, content: { imageUrl: "https://x.test/a.png", alt: "pic" } },
    { type: "code", position: 1, content: { text: "let a = 1", language: "ts" } },
    { type: "code", position: 2, content: { files: [{ name: "a.py", content: "print(1)", lang: "python" }] } },
  ] as any)
  assert.match(md, /!\[pic\]\(https:\/\/x\.test\/a\.png\)/)
  assert.match(md, /```ts\nlet a = 1\n```/)
  assert.match(md, /```python\nprint\(1\)\n```/)
})

// 7 ------------------------------------------------------------ voice dictation
test("voice dictation escapes text", async () => {
  const { textToParagraphHtml } = await import("@/lib/html")
  const html = textToParagraphHtml("<img src=x onerror=alert(1)>")
  assert.equal(html, "<p>&lt;img src=x onerror=alert(1)&gt;</p>")
})

// 8 ------------------------------------------------------------- markdown import
test("markdown import maps H1 to H2", async () => {
  currentFake = makeFakeClient((ctx: ResolveCtx): any => {
    if (ctx.table === "workspace_members") return { data: { workspace_id: "w1" } }
    if (ctx.table === "content_objects") return { data: { id: "p1" } }
    return { data: null }
  })
  const { importMarkdown } = await import("@/actions/content/pieces/creator/mutations")
  await importMarkdown({ data: { title: "T", markdown: "# Title\n\n#### Deep\n\n## Two" } })
  const ins = currentFake.calls.find((c) => c.table === "blocks" && c.op === "insert") as any
  assert.deepEqual(
    ins.rows.map((r: any) => r.content.level),
    [2, 3, 2]
  )
})

// 3 ------------------------------------------------------------ reader variants
test("reader shows mode variant", async () => {
  const { resolveBlockForMode } = await import("@/lib/reader-variants")
  const block: any = {
    type: "paragraph",
    content: { text: "long text", html: "<p>long text</p>", aiVariants: { skim: { text: "short text" } } },
  }
  const skim = resolveBlockForMode(block, "skim")
  assert.equal(skim.content.text, "short text")
  assert.notEqual(skim.content.html, "<p>long text</p>")
  assert.equal(resolveBlockForMode(block, "standard"), block)
  assert.equal(resolveBlockForMode(block, "expert"), block)
})

// 5 ---------------------------------------------------------------- Ollama
test("Ollama hidden when hosted", async () => {
  const { byokProviders } = await import("@/lib/ai-providers")
  env.NODE_ENV = "production"
  assert.ok(!byokProviders().some((p) => p.value === "ollama"))
  env.NODE_ENV = "development"
  assert.ok(byokProviders().some((p) => p.value === "ollama"))
})

test("server rejects ollama in production", async () => {
  currentFake = makeFakeClient((): any => ({
    data: { byok_provider: "ollama", byok_api_key: null, byok_model: null, plan: "free" },
  }))
  env.NODE_ENV = "production"
  const ai = await import("@/actions/ai")
  await assert.rejects(
    ai.generateModeVariant({ data: { mode: "skim", source: "hi" } }),
    /Ollama is only available when running locally/
  )
})

import { test, expect } from "@playwright/test"
import { randomUUID } from "crypto"
import { admin, fillLogin, createTestUser } from "./helpers"

test("an org invite link (signed out) leads through sign-in into the org", async ({ page }) => {
  test.setTimeout(90_000)
  const db = admin()
  const stamp = Date.now()
  const ownerId = await createTestUser(`org_owner_${stamp}@example.com`, `T-${randomUUID()}`)
  const email = `org_invitee_${stamp}@example.com`
  const password = `T-${randomUUID()}`
  const inviteeId = await createTestUser(email, password)
  const { data: org, error } = await db
    .from("organizations")
    .insert({ name: `Invite E2E ${stamp}`, slug: `invite-e2e-${stamp}`, plan: "org", owner_id: ownerId })
    .select("id, name")
    .single()
  expect(error).toBeNull()
  try {
    await db.from("org_members").insert({ org_id: org!.id, user_id: ownerId, role: "owner" })
    const token = `e2e${stamp}${randomUUID().replace(/-/g, "")}`.slice(0, 32)
    const { error: iErr } = await db
      .from("org_invites")
      .insert({ org_id: org!.id, email, role: "member", token })
    expect(iErr).toBeNull()

    await page.goto(`/studio/org?invite=${token}`)
    await page.waitForURL("**/login**")
    await fillLogin(page, email, password)

    await expect(page.getByText("You joined the organization")).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole("heading", { name: org!.name })).toBeVisible()
    const { data: member } = await db
      .from("org_members")
      .select("role")
      .eq("org_id", org!.id)
      .eq("user_id", inviteeId)
      .maybeSingle()
    expect(member?.role).toBe("member")
  } finally {
    if (org) await db.from("organizations").delete().eq("id", org.id)
    await db.auth.admin.deleteUser(inviteeId)
    await db.auth.admin.deleteUser(ownerId)
  }
})

// A published piece (with one text block and one public branch) owned by the
// local seed author; deleted afterwards.
async function seedPublishedPiece(page: import("@playwright/test").Page, title: string) {
  await page.goto("/login")
  await fillLogin(page, "test_studio@example.com", "TestPassword123!")
  await page.waitForURL("**/studio**", { timeout: 20_000 })
  await page.goto("/studio/drafts")
  await page.locator('button:has-text("Create piece")').first().click()
  await page.fill('input[placeholder="New piece title…"]', title)
  await page.click('button:has-text("Create")')
  await page.waitForURL(/\/studio\/drafts\/[0-9a-f-]{36}/, { timeout: 20_000 })
  const id = page.url().match(/drafts\/([0-9a-f-]{36})/)![1]
  await page.goto("about:blank")
  const db = admin()
  const { data: piece } = await db
    .from("content_objects")
    .update({ status: "published", visibility: "public", published_at: new Date().toISOString() })
    .eq("id", id)
    .select("slug, author_id")
    .single()
  await db.from("blocks").delete().eq("content_object_id", id)
  await db.from("blocks").insert({
    content_object_id: id,
    order: 0,
    type: "paragraph",
    content: { html: "<p>Body text for the dead-end checks.</p>", text: "Body text for the dead-end checks." },
    mode_visibility: ["skim", "standard", "expert", "teach", "debate"],
  })
  const { error: bErr } = await db.from("branches").insert({
    parent_content_object_id: id,
    parent_object_id: id,
    type: "debate",
    branch_type: "debate",
    purpose: "E2E counter-argument branch",
    visibility: "public",
    state: "published",
  })
  expect(bErr).toBeNull()
  const { data: author } = await db.from("profiles").select("handle").eq("id", piece!.author_id).single()
  return { id, slug: piece!.slug as string, handle: author!.handle as string }
}

async function dismissPopups(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Essential only" }).click({ timeout: 3000 }).catch(() => {})
  await page.getByRole("button", { name: "Maybe later" }).click({ timeout: 3000 }).catch(() => {})
}

test("saved list, private collections and graph branches open real pages", async ({ page, browser }) => {
  test.setTimeout(150_000)
  const title = `Dead-end E2E ${Date.now()}`
  const piece = await seedPublishedPiece(page, title)
  const email = `reader_e2e_${Date.now()}@example.com`
  const password = `T-${randomUUID()}`
  const readerId = await createTestUser(email, password)
  const reader = await browser.newPage()
  try {
    await reader.goto("/login")
    await fillLogin(reader, email, password)
    await reader.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 })

    // Saved list: Save → toast "View list" → the private Saved collection.
    await reader.goto(`/u/${piece.handle}/${piece.slug}`)
    await dismissPopups(reader)
    await reader.getByRole("button", { name: "Save", exact: true }).first().click()
    await reader.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click()
    await reader.getByRole("button", { name: "View list" }).click()
    await reader.waitForURL("**/collections/**")
    await expect(reader.getByRole("heading", { name: "Saved" })).toBeVisible({ timeout: 15_000 })
    // The saved piece links to its author's reader page, which renders.
    await reader.getByRole("link", { name: title }).click()
    await expect(reader.getByRole("heading", { name: title })).toBeVisible({ timeout: 15_000 })

    // Private collections are listed for their owner and open.
    await reader.goto("/collections")
    await reader
      .getByRole("region", { name: "Your collections" })
      .getByRole("link", { name: /Saved/ })
      .click()
    await expect(reader.getByRole("heading", { name: "Saved" })).toBeVisible({ timeout: 15_000 })
    await expect(reader.getByRole("link", { name: title })).toBeVisible()

    // Branch node in the author's knowledge graph → parent piece's branch list.
    await reader.goto(`/u/${piece.handle}`)
    await dismissPopups(reader)
    await reader.getByRole("tab", { name: /graph/i }).click()
    await reader.getByRole("link", { name: /Open debate branch/ }).first().click()
    await reader.waitForURL(`**/u/${piece.handle}/${piece.slug}**`)
    await expect(reader.locator("#branches")).toContainText("E2E counter-argument branch")
  } finally {
    await reader.close()
    const db = admin()
    await db.from("content_objects").delete().eq("id", piece.id)
    await db.from("collections").delete().eq("curator_id", readerId)
    await db.auth.admin.deleteUser(readerId)
  }
})

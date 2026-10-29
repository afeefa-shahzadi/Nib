import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables.")
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

async function seed() {
  console.log("Starting database seed...")

  // Mock Profile
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .upsert({
      id: "00000000-0000-0000-0000-000000000000",
      handle: "e2e_test_user",
      display_name: "E2E Test User",
      bio: "Automated test user",
      plan: "studio",
    })
    .select()
    .single()

  if (profileErr) {
    console.error("Error creating profile:", profileErr)
    process.exit(1)
  }

  console.log("Profile seeded:", profile.handle)

  // Mock Workspace (Org)
  const { data: org, error: orgErr } = await supabaseAdmin
    .from("organizations")
    .upsert({
      id: "11111111-1111-1111-1111-111111111111",
      slug: "e2e-test-org",
      name: "E2E Test Workspace",
      owner_id: profile.id,
    })
    .select()
    .single()

  if (orgErr) {
    console.error("Error creating org:", orgErr)
    process.exit(1)
  }

  console.log("Org seeded:", org.slug)

  // Mock Content Object
  const { data: content, error: contentErr } = await supabaseAdmin
    .from("content_objects")
    .upsert({
      id: "22222222-2222-2222-2222-222222222222",
      author_id: profile.id,
      org_id: org.id,
      title: "E2E Test Draft",
      slug: "e2e-test-draft",
      status: "draft",
      visibility: "public",
      tips_enabled: false,
      sponsorship_enabled: false,
    })
    .select()
    .single()

  if (contentErr) {
    console.error("Error creating content object:", contentErr)
    process.exit(1)
  }

  console.log("Content Object seeded:", content.slug)

  console.log("Database seed completed successfully.")
}

seed()

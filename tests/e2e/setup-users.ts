import { createClient } from "@supabase/supabase-js"
import { env } from "./helpers"

async function setup() {
  // env() reads .env.development.local / process.env only and asserts a local Supabase.
  const { NEXT_PUBLIC_SUPABASE_URL: sbUrl, SUPABASE_SECRET_KEY: sbKey } = env()

  if (!sbUrl || !sbKey) {
    console.error("Missing Supabase configuration in .env.development.local")
    process.exit(1)
  }

  const supabase = createClient(sbUrl, sbKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const testUsers = [
    {
      email: "visual_creator@example.com",
      password: "password123",
      displayName: "Visual Creator",
      handle: "v_creator",
      role: "creator",
    },
    {
      email: "visual_reader@example.com",
      password: "password123",
      displayName: "Visual Reader",
      handle: "v_reader",
      role: "reader",
    },
  ]

  for (const user of testUsers) {
    console.log(`Setting up user: ${user.email}`)

    // Check if user exists
    const { data: listData, error: listError } =
      await supabase.auth.admin.listUsers()
    if (listError) {
      console.error("Error listing users:", listError)
      process.exit(1)
    }

    let existingUser = listData.users.find((u) => u.email === user.email)

    if (existingUser) {
      console.log(`User ${user.email} already exists. Updating password...`)
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password: user.password }
      )
      if (updateError) {
        console.error("Error updating user password:", updateError)
      }
    } else {
      console.log(`User ${user.email} not found. Creating...`)
      const { data: createData, error: createError } =
        await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            display_name: user.displayName,
            handle: user.handle,
            role: user.role,
          },
        })
      if (createError) {
        console.error("Error creating user:", createError)
        continue
      }
      existingUser = createData.user
    }

    if (existingUser && user.role === "creator") {
      // Ensure role is in user_roles table
      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert(
          { user_id: existingUser.id, role: "creator" },
          { onConflict: "user_id,role" }
        )

      if (roleError) {
        console.error(
          `Error granting creator role to ${user.email}:`,
          roleError
        )
      } else {
        console.log(`Creator role ensured for ${user.email}`)
      }
    }
  }

  console.log("Test users successfully configured.")
}

setup().catch((e) => {
  console.error("Setup failed:", e)
  process.exit(1)
})

import { createClient } from "@supabase/supabase-js";


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables.");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

const password = "TestPassword123!";

const usersToCreate = [
  { email: "test_free@example.com", handle: "test_free", plan: "free", display_name: "Test Free User" },
  { email: "test_reader@example.com", handle: "test_reader", plan: "reader", display_name: "Test Reader User" },
  { email: "test_studio@example.com", handle: "test_studio", plan: "studio", display_name: "Test Studio User" },
  { email: "test_org@example.com", handle: "test_org", plan: "org", display_name: "Test Org User" }
];

async function seedTestUsers() {
  console.log("Starting test user seed...");

  for (const user of usersToCreate) {
    console.log(`Creating user: ${user.email} (${user.plan} plan)`);
    
    // 1. Create auth user
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: user.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        display_name: user.display_name,
        handle: user.handle,
      }
    });

    if (authErr) {
      console.log(`Failed to create auth user ${user.email} (might already exist): ${authErr.message}`);
    }

    const userId = authUser?.user?.id;
    if (!userId) {
      // Try to find the user if they already exist
      const { data: existingUsers, error: searchErr } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users.find(u => u.email === user.email);
      
      if (!existingUser) {
        console.error(`Could not find or create user ${user.email}`);
        continue;
      }
      
      // Update their profile plan
      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: existingUser.id,
          handle: user.handle,
          display_name: user.display_name,
          plan: user.plan
        });
        
      if (profileErr) {
        console.error(`Failed to update profile for ${user.email}:`, profileErr);
      } else {
        console.log(`Updated profile for ${user.email}`);
      }
      continue;
    }

    // 2. Wait a moment for trigger (if any) to create profile, then upsert
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        handle: user.handle,
        display_name: user.display_name,
        plan: user.plan
      });

    if (profileErr) {
      console.error(`Error updating profile for ${user.email}:`, profileErr);
    } else {
      console.log(`Successfully created/updated profile for ${user.email}`);
    }
  }

  console.log("Seed complete.");
}

seedTestUsers().catch(console.error);

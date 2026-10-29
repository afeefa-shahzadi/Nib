import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"

const env = fs.readFileSync(".env.local", "utf-8")
const supabaseUrlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)
const supabaseKeyMatch =
  env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) ||
  env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)

const supabaseUrl =
  supabaseUrlMatch?.[1]?.trim() || "https://ywaqihuivcsdfugeibga.supabase.co"
const supabaseKey = supabaseKeyMatch?.[1]?.trim()

if (!supabaseKey) {
  console.error("No supabase key found in env")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data, error } = await supabase.from("blocks").select("*").limit(1)
  if (error) {
    console.error("Error fetching blocks:", error)
  } else {
    console.log("Success! Columns found:")
    if (data && data.length > 0) {
      console.log(Object.keys(data[0]))
    } else {
      console.log(
        "No rows in blocks table, but query succeeded. We still don't know the exact columns unless we check information_schema."
      )
      const { data: cols, error: colErr } =
        await supabase.rpc("get_blocks_columns")
      console.log("RPC result:", cols, colErr)
    }
  }
}

check()

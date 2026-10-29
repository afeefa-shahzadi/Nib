import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import { writeFile, readFile, unlink } from "fs/promises"
import path from "path"
import os from "os"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit.server"

const execAsync = promisify(exec)

export async function POST(req: Request) {
  try {
    // This route spawns formatter processes on user input — gate it behind a
    // session and a per-user rate limit so it can't be hammered anonymously.
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const rl = await checkRateLimit("format", user.id, 60, 60)
    if (!rl.ok) return rateLimitResponse(rl.resetAt)

    const { code, language } = await req.json()
    if (!code || !language) return NextResponse.json({ code })

    const langMap: Record<string, { cmd: string, ext: string }> = {
      python: { cmd: "black", ext: ".py" },
      rust: { cmd: "rustfmt", ext: ".rs" },
      go: { cmd: "gofmt -w", ext: ".go" },
      c: { cmd: "clang-format -i", ext: ".c" },
      cpp: { cmd: "clang-format -i", ext: ".cpp" },
      java: { cmd: "clang-format -i", ext: ".java" },
      bash: { cmd: "shfmt -w", ext: ".sh" },
      sh: { cmd: "shfmt -w", ext: ".sh" },
      sql: { cmd: "sqlformat --reindent", ext: ".sql" }
    }

    const formatter = langMap[language.toLowerCase()]
    if (!formatter) {
      return NextResponse.json({ code })
    }

    const tmpFile = path.join(os.tmpdir(), `format_${Date.now()}_${Math.random().toString(36).slice(2)}${formatter.ext}`)
    
    await writeFile(tmpFile, code, "utf8")
    
    try {
      if (language.toLowerCase() === "sql") {
        const { stdout } = await execAsync(`${formatter.cmd} "${tmpFile}"`)
        await writeFile(tmpFile, stdout, "utf8")
      } else {
        await execAsync(`${formatter.cmd} "${tmpFile}"`)
      }
      
      const formattedCode = await readFile(tmpFile, "utf8")
      await unlink(tmpFile).catch(() => {})
      
      return NextResponse.json({ code: formattedCode })
    } catch {
      // Fail silently if formatter not installed or fails
      await unlink(tmpFile).catch(() => {})
      return NextResponse.json({ code })
    }
  } catch {
    return NextResponse.json({ code: "" })
  }
}

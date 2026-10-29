/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"

import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit.server"
import { canonicalRunLang } from "@/lib/code-languages"

// Piston runs as a separate container (sandboxes untrusted user code); it must
// never share a process with this app. Point PISTON_API_URL at wherever it's
// deployed (default: local docker on :2000). When the box is reachable over the
// public internet, set PISTON_AUTH_TOKEN to a shared secret and configure Piston
// to require it — so only this app can hit /execute.
// Run is only offered when PISTON_API_URL is set; env is read at call time.
// All Run gates (UI + executeCode) go through codeRunEnabled so other
// execution providers can be added there later.
export async function codeRunEnabled(): Promise<boolean> {
  return !!process.env.PISTON_API_URL
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, backoffMs = 1000): Promise<Response> {
  let attempt = 0;
  while (attempt < retries) {
    const response = await fetch(url, options);
    // If rate limited (429), wait and retry
    if (response.status === 429) {
      attempt++;
      if (attempt === retries) throw new Error("Rate limit exceeded. Please try again later.");
      await new Promise(resolve => setTimeout(resolve, backoffMs * Math.pow(2, attempt - 1)));
      continue;
    }
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    return response;
  }
  throw new Error("Failed after retries");
}

export async function executeCode(language: string, codeOrFiles: string | { name?: string; content: string }[]) {
  try {
    if (!(await codeRunEnabled())) return { success: false, error: "Code execution is not configured" }
    // Gate: a "use server" action is a public endpoint. Without this, anyone
    // could drive our Piston box with arbitrary code. Require a signed-in user
    // and cap runs per user (Piston is the expensive external resource).
    const {
      data: { user },
    } = await (await createClient()).auth.getUser()
    if (!user) return { success: false, error: "Sign in to run code." }
    const rl = await checkRateLimit("code_exec", user.id, 30, 60)
    if (!rl.ok)
      return { success: false, error: "Too many runs. Please wait a moment." }

    // Normalize aliases (js/ts/py/c++/sql) and gate on the shared runnable set.
    const mappedLang = canonicalRunLang(language);
    if (!mappedLang) {
      return { success: false, error: `Language '${language}' is not supported for execution.` };
    }

    const filesPayload = typeof codeOrFiles === "string" 
      ? [{ content: codeOrFiles }]
      : codeOrFiles.map(f => ({ name: f.name || undefined, content: f.content }));

    // Piston API requires version, but passing "*" usually picks the latest installed
    const payload = {
      language: mappedLang,
      version: "*",
      files: filesPayload,
      // We pass an empty string to stdin to avoid hanging programs
      stdin: "",
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = process.env.PISTON_AUTH_TOKEN
    if (token) headers.Authorization = `Bearer ${token}`;

    const base = process.env.PISTON_API_URL!.replace(/\/$/, "")
    const response = await fetchWithRetry(`${base}/api/v2/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.run) {
      return {
        success: true,
        output: data.run.stdout,
        error: data.run.stderr,
        signal: data.run.signal,
        code: data.run.code,
      };
    } else if (data.compile && data.compile.code !== 0) {
      return {
        success: true,
        output: "",
        error: data.compile.stderr || data.compile.stdout, // Compilation error
      };
    } else {
      return { success: false, error: "Invalid response from execution engine." };
    }
  } catch (error: any) {
    console.error("Code execution failed:", error);
    const msg = error instanceof Error ? error.message : "Execution failed.";
    return { success: false, error: msg };
  }
}

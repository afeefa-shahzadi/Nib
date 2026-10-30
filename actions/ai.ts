/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"
import { createAdminClient, createServiceRoleClient, createClient } from "@/lib/supabase/server"
import { generateText, embed, type ModelMessage } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createMistral } from "@ai-sdk/mistral"
import { checkRateLimit } from "@/lib/rate-limit.server"
import {
  aiDailyTokenLimit,
  aiPlanForLimit,
  AI_TOKEN_WINDOW_SECONDS,
  AI_MAX_OUTPUT_TOKENS,
  AI_MAX_INPUT_CHARS,
} from "@/lib/ai-limits"
import { decryptSecret } from "@/lib/crypto"
import { ollamaAvailable, OLLAMA_LOCAL_ONLY } from "@/lib/ai-providers"

const DEFAULT_MODEL = "mistral-small-latest"

// byok_api_key is sensitive and service-role-only under the profiles column
// grants; reading it via the cookie client runs as `authenticated` and is
// grant-denied, silently disabling BYOK for everyone. The caller verifies
// identity via the cookie session, then this reads with the true service role
// scoped to that id.
async function getByokProfile(userId: string) {
  const db = await createServiceRoleClient()
  const { data } = await db
    .from("profiles")
    .select("byok_api_key, byok_provider, byok_model, plan")
    .eq("id", userId)
    .maybeSingle()
  return data
}

async function callAI(
  messages: { role: string; content: string }[],
  options?: {
    model?: string
    apiKey?: string
    provider?: string
    system?: string
  }
) {
  const provider = options?.provider || "mistral"
  if (provider === "ollama" && !ollamaAvailable()) throw new Error(OLLAMA_LOCAL_ONLY)
  const modelName = options?.model || ""
  const key = options?.apiKey || process.env.MISTRAL_API_KEY

  if (!key && provider !== "ollama")
    throw new Error("AI is not configured. Add an API key.")

  // Per-request input ceiling: reject an oversized prompt before it ever hits
  // the model, so one giant paste can't run up a single huge bill.
  const inputChars = messages.reduce((n, m) => n + (m.content?.length ?? 0), 0)
  if (inputChars > AI_MAX_INPUT_CHARS)
    throw new Error("That's too much text for one AI request. Trim it and try again.")

  let aiModel

  switch (provider) {
    case "openai":
      aiModel = createOpenAI({ apiKey: key })(modelName || "gpt-4o")
      break
    case "anthropic":
      aiModel = createAnthropic({ apiKey: key })(
        modelName || "claude-3-5-sonnet-20240620"
      )
      break
    case "google":
      aiModel = createGoogleGenerativeAI({ apiKey: key })(
        modelName || "gemini-1.5-pro"
      )
      break
    case "openrouter":
      aiModel = createOpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: key,
      })(modelName || "meta-llama/llama-3-8b-instruct")
      break
    case "ollama":
      aiModel = createOpenAI({
        baseURL: "http://localhost:11434/v1",
        apiKey: "ollama",
      })(modelName || "llama3")
      break
    case "nvidia":
      aiModel = createOpenAI({
        baseURL: "https://integrate.api.nvidia.com/v1",
        apiKey: key,
      })(modelName || "meta/llama3-70b-instruct")
      break
    case "mistral":
    default:
      aiModel = createMistral({ apiKey: key })(modelName || DEFAULT_MODEL)
      break
  }

  try {
    const systemMsg = options?.system || messages.find((m) => m.role === "system")?.content
    const userMessages = messages.filter((m) => m.role !== "system")

    const { text, usage } = await generateText({
      model: aiModel,
      system: systemMsg,
      messages: userMessages as ModelMessage[],
      // Per-request output ceiling: bounds the expensive half of every call.
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    })

    if (typeof text !== "string") throw new Error("AI returned no content")
    return { text: text.trim(), tokens: usage.totalTokens }
  } catch (error) {
    // After its retries give up the AI SDK throws a RetryError; the provider's
    // HTTP status is on lastError. Raw SDK messages ("Failed after 3
    // attempts…", provider URLs) reached reader toasts verbatim.
    const e = ((error as { lastError?: unknown })?.lastError ?? error) as Record<string, unknown>
    const status = e?.statusCode || e?.status
    if (status === 429) {
      throw new Error("AI rate limit hit. Try again in a minute.")
    }
    if (status === 402) {
      throw new Error(
        "AI credits exhausted. Add credits in Settings → Workspace → Usage."
      )
    }
    console.error("[server] AI request failed", error)
    throw new Error("The AI service didn't respond. Please try again in a moment.")
  }
}

// Standard is always the author's own text, so it has no AI variant.
type Mode = "skim" | "expert" | "teach" | "debate" | "eli5"

const MODE_INSTRUCTION: Record<Mode, string> = {
  skim: "Produce a highly condensed, high-signal summary of the text in 1–2 sentences. Exclude all filler, jargon, and secondary details. Focus strictly on the primary thesis, core claim, and key takeaway to maximize scanning velocity for busy readers.",
  expert:
    "Rewrite the text to elevate its analytical depth for an expert-level audience in 2–4 sentences. Use precise, industry-standard terminology and articulate subtle conceptual nuances. Keep any sources, figures or citations the source text already contains; never add a source, statistic, quote, name or citation that is not in the source.",
  teach:
    "Structure this block as an engaging pedagogical beat. First, lead with the essential key takeaway in bold. Second, provide a crystal-clear, intuitive explanation of the concept using a relatable analogy or step-by-step logic. Finally, conclude with a single, thought-provoking 'check-for-understanding' question to help solidify learning.",
  debate:
    "Synthesize the source content into a balanced, intellectually stimulating dialectic prompt. Articulate the strongest, steel-manned counter-argument to the text's core claim (2-3 sentences), followed immediately by a robust defense or synthesis that addresses the critique (2-3 sentences). Highlight the fundamental tension.",
  eli5:
    "Explain this concept as if I were a 5-year-old. Use extremely simple words, short sentences, and a very relatable everyday analogy. Remove all jargon, complex clauses, and assumed knowledge. The goal is pure, intuitive comprehension.",
}

// Production hides messages thrown from server actions ("An error occurred in
// the Server Components render…"), so readers never saw "try again in a
// minute". Expected failures come back as { error } instead.
export async function generateModeVariant(
  _args: { data?: any } = {}
): Promise<{ text: string; error?: undefined } | { text?: undefined; error: string }> {
  try {
    return await modeVariant(_args)
  } catch (e) {
    return { error: (e as Error).message || "The AI service didn't respond. Please try again in a moment." }
  }
}

async function modeVariant(_args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const profile = await getByokProfile(user.id)
  const apiKey = profile?.byok_api_key ? decryptSecret(profile.byok_api_key) : null
  const provider = profile?.byok_provider
  const model = profile?.byok_model
  const aiLimit = aiDailyTokenLimit(aiPlanForLimit(profile?.plan))

  if (!apiKey && provider !== "ollama") {
    if (aiLimit <= 0)
      throw new Error(
        "Platform AI is currently off. Add your API key in Settings to continue."
      )
    const preCheck = await checkRateLimit(
      "ai_tokens",
      user.id,
      aiLimit,
      AI_TOKEN_WINDOW_SECONDS,
      0
    )
    if (!preCheck.ok)
      throw new Error(
        "Daily AI limit reached. Add your API key in Settings for more."
      )
  }

  const __handler = async ({
    data,
  }: {
    data: {
      blockType?: string
      blockId?: string
      mode: Mode
      source: string
    }
  }) => {
    if (!MODE_INSTRUCTION[data.mode]) throw new Error("Unknown reading mode")
    const { text, tokens } = await callAI(
      [
        {
          role: "system",
          content:
            "You are Nib's advanced editorial intelligence. Your task is to rewrite a single content block to match the specified reading mode instructions. Never introduce facts, sources, statistics, quotes or citations that are not in the source text. Output ONLY the rewritten block content. Do not include introductory text, explanations, markdown code blocks, metadata, or commentary.",
        },
        {
          role: "user",
          content: `Block type: ${data.blockType ?? "paragraph"}\nTarget mode: ${data.mode}\nInstruction: ${MODE_INSTRUCTION[data.mode]}\n\nSource:\n${data.source}`,
        },
      ],
      {
        model: model || undefined,
        apiKey: apiKey || undefined,
        provider: provider || undefined,
      }
    )

    if (!apiKey && provider !== "ollama") {
      await checkRateLimit(
        "ai_tokens",
        user.id,
        aiLimit,
        AI_TOKEN_WINDOW_SECONDS,
        tokens
      )
    }

    if (data.blockId) {
      // Only persist a variant if the block belongs to the caller's piece.
      const { data: block } = await supabaseAdmin
        .from("blocks")
        .select("content_object_id")
        .eq("id", data.blockId)
        .maybeSingle()
      const { data: piece } = block
        ? await supabaseAdmin
            .from("content_objects")
            .select("author_id")
            .eq("id", block.content_object_id)
            .maybeSingle()
        : { data: null }
      if (piece && piece.author_id === user.id) {
        const { error } = await supabaseAdmin.from("ai_variants").insert({
          block_id: data.blockId,
          mode: data.mode,
          prompt: MODE_INSTRUCTION[data.mode],
          generated_text: { text },
          status: "pending",
        })
        if (error) {
          console.error("[server] Failed to save variant:", error)
        }
      }
    }

    return { text }
  }
  return await __handler({
    data: _args?.data as {
      blockType?: string
      blockId?: string
      mode: Mode
      source: string
    },
  })
}

export async function suggestPieceMeta(_args: { data?: any } = {}) {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const profile = await getByokProfile(user.id)
  const apiKey = profile?.byok_api_key ? decryptSecret(profile.byok_api_key) : null
  const provider = profile?.byok_provider
  const model = profile?.byok_model
  const aiLimit = aiDailyTokenLimit(aiPlanForLimit(profile?.plan))

  if (!apiKey && provider !== "ollama") {
    if (aiLimit <= 0)
      throw new Error(
        "Platform AI is currently off. Add your API key in Settings to continue."
      )
    const preCheck = await checkRateLimit(
      "ai_tokens",
      user.id,
      aiLimit,
      AI_TOKEN_WINDOW_SECONDS,
      0
    )
    if (!preCheck.ok)
      throw new Error(
        "Daily AI limit reached. Add your API key in Settings for more."
      )
  }

  const __handler = async ({
    data,
  }: {
    data: {
      title?: string
      blocksText: string
    }
  }) => {
    const { text, tokens } = await callAI(
      [
        {
          role: "system",
          content:
            'You are a high-level content analyst. Read the provided text and synthesize it. You must return ONLY a valid, minified JSON object containing exactly three keys: "summary" (a high-level, scannable overview, strictly under 160 characters), "thesis" (the core underlying argument, strictly under 240 characters), and "tags" (a single comma-separated string of 3-5 highly relevant, lowercase keywords). Do not wrap the JSON in markdown fences, and do not provide any explanation or preamble.',
        },
        {
          role: "user",
          content: `Title: ${data.title ?? "(untitled)"}\n\nContent:\n${data.blocksText}`,
        },
      ],
      {
        model: model || undefined,
        apiKey: apiKey || undefined,
        provider: provider || undefined,
      }
    )

    if (!apiKey && provider !== "ollama") {
      await checkRateLimit(
        "ai_tokens",
        user.id,
        aiLimit,
        AI_TOKEN_WINDOW_SECONDS,
        tokens
      )
    }

    try {
      const cleaned = text
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/g, "")
        .trim()
      const j = JSON.parse(cleaned)
      return {
        summary: String(j.summary ?? "").slice(0, 300),
        thesis: String(j.thesis ?? "").slice(0, 600),
        tags: String(j.tags ?? "").slice(0, 200),
      }
    } catch {
      return { summary: text.slice(0, 300), thesis: "", tags: "" }
    }
  }
  return await __handler({
    data: _args?.data as {
      title?: string
      blocksText: string
    },
  })
}

export async function suggestCounterThesis(_args: { data?: any } = {}) {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const profile = await getByokProfile(user.id)
  const apiKey = profile?.byok_api_key ? decryptSecret(profile.byok_api_key) : null
  const provider = profile?.byok_provider
  const model = profile?.byok_model
  const aiLimit = aiDailyTokenLimit(aiPlanForLimit(profile?.plan))

  if (!apiKey && provider !== "ollama") {
    if (aiLimit <= 0)
      throw new Error(
        "Platform AI is currently off. Add your API key in Settings to continue."
      )
    const preCheck = await checkRateLimit(
      "ai_tokens",
      user.id,
      aiLimit,
      AI_TOKEN_WINDOW_SECONDS,
      0
    )
    if (!preCheck.ok)
      throw new Error(
        "Daily AI limit reached. Add your API key in Settings for more."
      )
  }

  const __handler = async ({
    data,
  }: {
    data: {
      thesis: string
    }
  }) => {
    const { text, tokens } = await callAI(
      [
        {
          role: "system",
          content:
            "You are an objective intellectual sparring partner. Generate a sharp, fair-minded, and intellectually rigorous counter-thesis (1–2 sentences) that challenges the core assumptions of the provided claim. Return ONLY the counter-thesis text without any introduction or commentary.",
        },
        { role: "user", content: data.thesis },
      ],
      {
        model: model || undefined,
        apiKey: apiKey || undefined,
        provider: provider || undefined,
      }
    )

    if (!apiKey && provider !== "ollama") {
      await checkRateLimit(
        "ai_tokens",
        user.id,
        aiLimit,
        AI_TOKEN_WINDOW_SECONDS,
        tokens
      )
    }

    return { text }
  }
  return await __handler({
    data: _args?.data as {
      thesis: string
    },
  })
}

// ---------- GRAPH SYNTHESIS & ADVANCED INTELLIGENCE ----------

export async function calculateGraphCentrality(_args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const __handler = async ({ data }: { data: { pieceId: string, blocksText: string } }) => {
    const { data: piece } = await supabaseAdmin
      .from("content_objects")
      .select("author_id")
      .eq("id", data.pieceId)
      .maybeSingle()
    if (!piece || piece.author_id !== user.id) throw new Error("Unauthorized")

    const { data: blocks } = await supabaseAdmin
      .from("blocks")
      .select("id, content")
      .eq("content_object_id", data.pieceId)

    if (!blocks || blocks.length === 0) return []

    const blockList = blocks.map(b => `Block ID [${b.id}]: ${JSON.stringify(b.content)}`).join("\n\n")

    const { text } = await callAI([
      { role: "user", content: `Blocks:\n${blockList}` }
    ], { system: "You are an advanced graph centrality algorithm. Analyze the following document blocks and determine how central/representative each block is to the overall thesis of the piece. Output a valid JSON array of objects, where each object has `blockId` (string - MUST match the provided Block ID exactly), `centralityScore` (number between 0.0 and 1.0), and `keyTheme` (string). Return ONLY the JSON array." })

    try {
      return JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/g, "").trim())
    } catch {
      return []
    }
  }
  return await __handler({ data: _args?.data as { pieceId: string, blocksText: string } })
}

export async function suggestAutoLinks(_args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const __handler = async ({ data }: { data: { pieceId: string, blocksText: string } }) => {
    const { text } = await callAI([
      { role: "user", content: data.blocksText }
    ], { system: "Extract 2-3 key thematic claims from this text as a valid JSON array of strings. ONLY output the JSON array." })

    let claims: string[] = []
    try {
      claims = JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/g, "").trim())
    } catch {
      return []
    }

    const key = process.env.MISTRAL_API_KEY
    if (!key) return []

    const mistral = createMistral({ apiKey: key })
    const results = []

    for (const claim of claims) {
      const { embedding } = await embed({ model: mistral.embedding("mistral-embed"), value: claim })
      const { data: blocks, error } = await supabaseAdmin.rpc("match_blocks", {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 5,
      })

      if (error) {
        console.error("Match blocks error:", error)
      }

      if (blocks) {
        for (const b of blocks) {
          // Exclude blocks from the current piece
          if (b.content_object_id !== data.pieceId) {
            const { data: piece } = await supabaseAdmin.from("content_objects").select("slug, profiles(handle)").eq("id", b.content_object_id).eq("status", "published").eq("visibility", "public").maybeSingle()
            if (piece) {
              const prof = Array.isArray(piece.profiles) ? piece.profiles[0] : piece.profiles
              results.push({
                sourceText: claim,
                targetPieceId: b.content_object_id,
                targetSlug: piece.slug,
                targetHandle: (prof as { handle?: string } | null)?.handle ?? null,
                confidence: b.similarity || 0.8
              })
              break
            }
          }
        }
      }
    }
    return results
  }
  return await __handler({ data: _args?.data as { pieceId: string, blocksText: string } })
}

export async function suggestBundleCuration(_args: { data?: any } = {}) {
  const supabaseAdmin = await createAdminClient()
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const __handler = async ({ data }: { data: { topic: string } }) => {
    const { data: pieces } = await supabaseAdmin
      .from("content_objects")
      .select("id, title, summary")
      .eq("author_id", user.id)
      .eq("status", "published")

    if (!pieces || pieces.length === 0) return { suggestedTitle: data.topic, suggestedPieces: [] }

    const catalog = pieces.map(p => `ID: ${p.id} | Title: ${p.title} | Summary: ${p.summary}`).join("\n")
    const { text } = await callAI([
      { role: "user", content: `Topic: ${data.topic}\n\nPieces:\n${catalog}` }
    ], { system: "You are an expert curator. Given a list of published pieces and a target topic, select the most relevant pieces to form a bundle. Output a valid JSON object with `suggestedTitle` (string) and `suggestedPieces` (array of objects with `id` and `title`). Return ONLY the JSON object." })

    try {
      return JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/g, "").trim())
    } catch {
      return { suggestedTitle: data.topic, suggestedPieces: [] }
    }
  }
  return await __handler({ data: _args?.data as { topic: string } })
}

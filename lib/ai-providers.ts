// Ollama talks to localhost:11434 from the server, which only exists on a dev
// machine. Hosted (production) it would hit the server itself, so it is hidden
// in the BYOK picker and rejected server-side.
export const OLLAMA_LOCAL_ONLY = "Ollama is only available when running locally"

export const ollamaAvailable = () => process.env.NODE_ENV !== "production"

const PROVIDERS = [
  { value: "mistral", label: "Mistral AI" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google Gemini" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "ollama", label: "Ollama (Local)" },
  { value: "nvidia", label: "NVIDIA NIM" },
]

export const byokProviders = () =>
  PROVIDERS.filter((p) => p.value !== "ollama" || ollamaAvailable())

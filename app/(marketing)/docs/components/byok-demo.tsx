"use client"

import { useState } from "react"
import { DemoToolbar } from "./demo-toolbar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Cpu, Check, Key } from "lucide-react"

export function ByokDemo() {
  const [provider, setProvider] = useState("mycelium")
  const [apiKey, setApiKey] = useState("")

  const providers = [
    { id: "mycelium", name: "Nib Default", limits: "Daily allowance" },
    { id: "mistral", name: "Mistral AI", limits: "No Nib limit (your key)" },
    { id: "openai", name: "OpenAI", limits: "No Nib limit (your key)" },
    { id: "anthropic", name: "Anthropic", limits: "No Nib limit (your key)" },
    { id: "google", name: "Google Gemini", limits: "No Nib limit (your key)" },
    { id: "openrouter", name: "OpenRouter", limits: "No Nib limit (your key)" },
  ]

  return (
    <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <h3 className="font-semibold">BYOK Configuration Demo</h3>
        <DemoToolbar
          label="BYOK"
          onReset={() => {
            setProvider("mycelium")
            setApiKey("")
          }}
        />
      </div>
      <div className="p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Select Provider</h4>
            <div className="grid gap-2">
              {providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={`flex items-center justify-between rounded-md border p-3 text-left transition-colors ${
                    provider === p.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Cpu
                      className={`size-4 ${provider === p.id ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                  {provider === p.id && (
                    <Check className="size-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <Key className="size-4 text-primary" /> Active Configuration
            </h4>

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Rate Limits
                </Label>
                <p className="text-sm font-medium">
                  {providers.find((p) => p.id === provider)?.limits}
                </p>
              </div>

              {provider !== "mycelium" && (
                <div className="animate-in space-y-1.5 fade-in slide-in-from-top-2">
                  <Label className="text-xs text-muted-foreground">
                    API Key
                  </Label>
                  <Input
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="h-8 bg-background text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Stored encrypted on Nib&apos;s server and never shown
                    again. This demo doesn&apos;t send it anywhere.
                  </p>
                </div>
              )}

              {provider !== "mycelium" && apiKey.length > 5 && (
                <div className="animate-in rounded border border-success/20 bg-success/10 p-3 fade-in">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-success">
                    <Check className="size-3" /> Key saved (demo)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

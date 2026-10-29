/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import mermaid from "mermaid"
import { sanitizeMermaidSvg } from "./sanitize-mermaid-svg"
import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"

export function MermaidRenderer({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  const { resolvedTheme } = useTheme()
  const [mounted] = useState(true)

  useEffect(() => {
    // setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    let active = true

    mermaid.initialize({
      startOnLoad: false,
      theme: resolvedTheme === "dark" ? "dark" : "default",
      themeVariables:
        resolvedTheme === "dark"
          ? {
              signalColor: "#e2e8f0",
              signalTextColor: "#e2e8f0",
              labelTextColor: "#e2e8f0",
              textColor: "#e2e8f0",
              titleColor: "#e2e8f0",
              edgeLabelBackground: "#0f172a",
              lineColor: "#e2e8f0",
              actorTextColor: "#1e293b", // Dark text inside light actor boxes
              actorLineColor: "#e2e8f0",
              noteTextColor: "#e2e8f0",
              messageTextColor: "#e2e8f0",
              activationBorderColor: "#e2e8f0",
              activationBkgColor: "#e2e8f0",
              sequenceNumberColor: "#e2e8f0",
              pieTitleTextSize: "16px",
              pieTitleTextColor: "#e2e8f0",
              pieSectionTextColor: "#1e293b",
              pieLegendTextColor: "#e2e8f0",
            }
          : {},
      // strict: escape HTML in node labels and disable click/JS directives, so a
      // user-authored diagram can't inject markup into the rendered SVG (XSS).
      securityLevel: "strict",
      fontFamily: "var(--font-sans)",
    })

    const renderMermaid = async () => {
      if (!code) {
        setSvg("")
        setError(null)
        return
      }
      try {
        const themeConfig =
          resolvedTheme === "dark"
            ? `%%{init: {
              'theme': 'dark',
              'themeVariables': {
                'signalColor': '#e2e8f0',
                'signalTextColor': '#e2e8f0',
                'labelTextColor': '#e2e8f0',
                'textColor': '#e2e8f0',
                'titleColor': '#e2e8f0',
                'actorTextColor': '#1e293b',
                'actorLineColor': '#e2e8f0',
                'noteTextColor': '#e2e8f0',
                'messageTextColor': '#e2e8f0',
                'pieTitleTextColor': '#e2e8f0',
                'pieSectionTextColor': '#1e293b',
                'pieLegendTextColor': '#e2e8f0'
              }
            }}%%\n`
            : `%%{init: {'theme': 'default'}}%%\n`

        const codeToRender = code.startsWith("%%{init:")
          ? code
          : themeConfig + code
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
        const { svg: renderedSvg } = await mermaid.render(id, codeToRender)
        if (active) {
          // Defense in depth: scrub the rendered SVG before we inject it raw.
          setSvg(sanitizeMermaidSvg(renderedSvg))
          setError(null)
        }
      } catch (e: any) {
        if (active) setError((e as Error).message ?? "Mermaid syntax error")
      }
    }

    renderMermaid()

    return () => {
      active = false
    }
  }, [code, resolvedTheme, mounted])

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 font-mono text-xs text-destructive">
        {error}
      </div>
    )
  }

  if (!svg) {
    return <div className="h-32 animate-pulse rounded-md bg-muted/50" />
  }

  return (
    <div
      ref={ref}
      className="flex justify-center overflow-x-auto py-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

type ExportBlock = {
  type: string
  position?: number
  content?: {
    text?: string
    url?: string
    imageUrl?: string
    alt?: string
    caption?: string
    lang?: string
    language?: string
    files?: { name?: string; content?: string; lang?: string }[]
  }
}

const fence = (lang: string | undefined, code: string) =>
  `\`\`\`${lang && lang !== "text" ? lang : ""}\n${code}\n\`\`\`\n\n`

export function blocksToMarkdown(title: string, blocks: ExportBlock[]) {
  const sorted = [...blocks].sort(
    (a, b) => (a.position || 0) - (b.position || 0)
  )
  let md = `# ${title}\n\n`
  for (const b of sorted) {
    const c = b.content
    const text = c?.text || ""
    switch (b.type) {
      case "heading":
        md += `## ${text}\n\n`
        break
      case "quote":
        md += `> ${text}\n\n`
        break
      case "code":
        // Composer code blocks keep their source in content.files[]; imported
        // ones use content.text + content.lang.
        if (c?.files?.length)
          for (const f of c.files) md += fence(f.lang, f.content || "")
        else md += fence(c?.lang || c?.language, text)
        break
      case "image":
        // Image blocks store imageUrl (content.url was never written).
        md += `![${c?.alt || c?.caption || text}](${c?.imageUrl || c?.url || ""})\n\n`
        break
      default:
        if (text) md += `${text}\n\n`
        break
    }
  }
  return md
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c])

// Plain text (e.g. voice dictation) -> a safe single-paragraph HTML string.
export const textToParagraphHtml = (text: string) => `<p>${escapeHtml(text)}</p>`

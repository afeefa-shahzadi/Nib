import DOMPurify from "isomorphic-dompurify"

// Mermaid flowcharts put node/edge labels in <foreignObject> HTML (div/span/p).
// The SVG-only profile stripped them, so diagrams rendered as empty boxes.
// Allow the HTML profile too; DOMPurify still drops scripts and on* handlers.
export function sanitizeMermaidSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true, html: true },
    ADD_TAGS: ["foreignObject"],
    // Let HTML label content live under foreignObject (DOMPurify's namespace
    // check drops it otherwise). Keys are lowercase tag names.
    HTML_INTEGRATION_POINTS: { foreignobject: true, "annotation-xml": true },
  })
}

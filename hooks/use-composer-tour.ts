 
import { useEffect, useRef } from "react"
import { driver } from "driver.js"
import "driver.js/dist/driver.css"

// Below lg the side panes are sheets, so those steps point at the buttons that
// open them; only one of each pair is ever in the DOM.
const target = (selector: string) => () => document.querySelector(selector) as Element

export function useComposerTour(autoStart = true) {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null)

  useEffect(() => {
    // Initialize the driver instance
    driverRef.current = driver({
      showProgress: true,
      animate: true,
      smoothScroll: true,
      allowClose: true,
      popoverClass: "theme-driver-popover",
      showButtons: ["next", "previous", "close"],
      doneBtnText: "Done",
      nextBtnText: "Next",
      prevBtnText: "Back",
      steps: [
        {
          popover: {
            title: "Welcome to the Nib composer",
            description: "Let's take a quick tour of the composer. This is where your ideas grow.",
          }
        },
        {
          element: "#tour-canvas",
          popover: {
            title: "The Canvas",
            description: "This is your main writing area: a column of blocks — text, images, embeds and more — that you can move up and down.",
            side: "top",
            align: "center"
          }
        },
        {
          element: "#tour-block-create",
          popover: {
            title: "Creating Content",
            description: `Type '/' in an empty block to open the Slash Menu, or just start typing. Each paragraph or item is its own block.
<br/><br/>
<strong class="text-foreground">Available Block Types:</strong>
<ul class="mt-2 space-y-1 list-disc pl-4 text-xs text-muted-foreground">
  <li><b>Paragraph & Heading:</b> Standard text and structure.</li>
  <li><b>Image & Audio:</b> Insert rich media.</li>
  <li><b>Code:</b> Syntax-highlighted snippets.</li>
  <li><b>Quote & Callout:</b> Highlight important text.</li>
  <li><b>Mermaid & Flowchart:</b> Render diagrams natively.</li>
  <li><b>Thesis & Evidence:</b> Structure arguments.</li>
</ul>`,
            side: "right",
            align: "start"
          }
        },
        {
          element: target("#tour-outline, #tour-outline-button"),
          popover: {
            title: "Outline & History",
            description: `Use the <b>Outline</b> tab to see your piece's structure at a glance and jump to any block.<br/><br/>Switch to the <b>History</b> tab to view past commits and restore previous versions of your piece.`,
            side: "right",
            align: "start"
          }
        },
        {
          element: target("#tour-inspector, #tour-inspector-button"),
          popover: {
            title: "Inspector & Archive",
            description: `Select any block to use the <b>Inspector</b>: set which reading modes show it, give it a role, and use AI to generate mode variants.<br/><br/>Switch to the <b>Archive</b> tab to search and reuse content from your past writing.`,
            side: "left",
            align: "start"
          }
        },
        {
          element: "#tour-more",
          popover: {
            title: "Metadata & Publishing",
            description: "When you're ready, open this menu and choose Meta to add a summary and tags and set up tips and sponsors before hitting Publish.",
            side: "bottom",
            align: "end"
          }
        }
      ],
      // driver.js puts aria-haspopup/expanded on its role-less dummy anchor (axe: aria-allowed-attr).
      onHighlighted: () => {
        const d = document.getElementById("driver-dummy-element")
        d?.removeAttribute("aria-expanded")
        d?.removeAttribute("aria-haspopup")
        d?.removeAttribute("aria-controls")
      },
      onDestroyed: () => {
        // Mark as seen when the user closes or finishes the tour
        if (typeof window !== "undefined") {
          localStorage.setItem("mycelium:composer_tour_seen", "true")
        }
      }
    })

    // Auto-start if they haven't seen it — but only once the piece has loaded,
    // so the tour never fires over an error/"Piece not found" screen where its
    // target elements (#tour-canvas, etc.) don't exist.
    let timer: ReturnType<typeof setTimeout> | undefined
    if (autoStart && typeof window !== "undefined") {
      const hasSeenTour = localStorage.getItem("mycelium:composer_tour_seen")
      if (!hasSeenTour) {
        // Slight delay to allow DOM to render and stabilize
        timer = setTimeout(() => {
          driverRef.current?.drive()
        }, 500)
      }
    }

    return () => {
      if (timer) clearTimeout(timer)
      driverRef.current?.destroy()
    }
  }, [autoStart])

  const startTour = () => {
    if (driverRef.current) {
      driverRef.current.drive(0)
    }
  }

  return { startTour }
}

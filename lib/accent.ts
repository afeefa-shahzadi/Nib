export const ACCENT_KEY = "nib-accent"
// Runs before paint (app/layout.tsx) so the saved accent never flashes.
export const ACCENT_SCRIPT = `try{var a=localStorage.getItem("${ACCENT_KEY}");document.documentElement.dataset.accent=/^(ink|oxblood|teal)$/.test(a)?a:"ink"}catch(e){document.documentElement.dataset.accent="ink"}`

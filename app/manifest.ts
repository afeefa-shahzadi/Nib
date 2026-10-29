import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nib",
    short_name: "Nib",
    description: "Adaptive publishing for serious creators.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f4ec",
    theme_color: "#2f5196",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  }
}

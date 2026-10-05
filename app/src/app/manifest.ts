import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nimzo",
    short_name: "Nimzo",
    description: "A personal chess coach.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d241b",
    theme_color: "#0d241b",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/badge.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}

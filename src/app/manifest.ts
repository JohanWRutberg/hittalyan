import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ledigt – nya hyresrätter i Stockholm",
    short_name: "Ledigt",
    description: "Bevaka nya hyresrätter hos Bostadsförmedlingen i Stockholm och få notis direkt.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f5f9fb",
    theme_color: "#157e6c",
    lang: "sv",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

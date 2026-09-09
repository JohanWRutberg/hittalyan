import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations("meta");
  return {
    name: t("title"),
    short_name: "Hitta Lyan",
    description: t("description"),
    start_url: "/lagenheter",
    scope: "/",
    display: "standalone",
    background_color: "#f5f9fb",
    theme_color: "#157e6c",
    // Den maskerbara varianten är en egen fil: Android klipper ikonen till sin
    // egen form och garanterar bara den inre cirkeln, så den har mindre hus och
    // färg ut i kanterna. Ritas av scripts/generate-icons.mjs.
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

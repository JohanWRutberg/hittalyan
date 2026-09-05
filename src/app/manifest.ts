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
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

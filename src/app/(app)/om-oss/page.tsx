import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProsePage } from "@/components/prose-page";

const SECTIONS = ["what", "why", "how", "independent", "money"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.pages");
  return { title: t("about") };
}

export default async function AboutPage() {
  const t = await getTranslations("about");
  return (
    <ProsePage
      title={t("title")}
      lead={t("lead")}
      sections={SECTIONS.map((k) => ({ title: t(`sections.${k}.title`), body: t(`sections.${k}.body`) }))}
    />
  );
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProsePage } from "@/components/prose-page";

const SECTIONS = ["source", "accuracy", "noAffiliation", "noApplication", "chance", "queueTime", "availability", "liability"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.pages");
  return { title: t("disclaimer") };
}

export default async function DisclaimerPage() {
  const t = await getTranslations("disclaimer");
  return (
    <ProsePage
      title={t("title")}
      lead={t("lead")}
      sections={SECTIONS.map((k) => ({ title: t(`sections.${k}.title`), body: t(`sections.${k}.body`) }))}
      footnote={t("updated")}
    />
  );
}

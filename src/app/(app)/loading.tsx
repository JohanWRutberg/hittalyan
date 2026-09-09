import { getTranslations } from "next-intl/server";
import { Skeleton, SkeletonHeading } from "@/components/skeleton";

/**
 * Skelett för alla sidor i det inloggade läget som inte har ett eget. Menyn och
 * sidfoten ligger i layouten och står kvar; det här ersätter bara innehållet.
 */
export default async function Loading() {
  const t = await getTranslations("common");
  return (
    <div className="space-y-6" role="status" aria-label={t("loading")}>
      <SkeletonHeading />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/skeleton";

/**
 * Skelett för annonslistan. Formen följer den riktiga sidan – rubrik, kötidskort,
 * filterrad, karta och kortrutnät – så att innehållet inte hoppar när det landar.
 * Det är den tyngsta sidan vi har (en rikstäckande kö skickar tusentals annonser
 * till webbläsaren), och därmed den som tjänar mest på att svara direkt.
 */
export default async function Loading() {
  const t = await getTranslations("common");
  return (
    <div className="space-y-6" role="status" aria-label={t("loading")}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2.5">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-14 w-56 max-w-full rounded-2xl" />
      </div>

      {/* Filterraden */}
      <Skeleton className="h-14 rounded-2xl" />

      {/* Kartan, i samma höjd som den fällda kartan har */}
      <Skeleton className="h-44 rounded-2xl sm:h-72" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-72 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

"use client";

import { useLocale, useTranslations } from "next-intl";
import { chanceFor, chanceRange, type ChanceSource } from "@/lib/chance";
import { formatYearsShort } from "@/lib/format";
import type { Locale } from "@/i18n/config";

/** Skala för mätaren i år. Allt över klipps mot höger kant. */
const SCALE_YEARS = 20;
const pct = (y: number) => `${Math.min(100, Math.max(0, (y / SCALE_YEARS) * 100))}%`;

/**
 * Chansen att få lägenheten, jämfört med förmedlingens kötidsstatistik.
 * Stockholm anger kvartiler, Boplats Väst ett områdessnitt (som visas som ett
 * antaget spann). Förmedlingar utan kötidsstatistik visar antal sökande i
 * stället och renderar inte den här mätaren alls.
 */
export function ChanceMeter({
  userYears,
  listing,
  compact,
}: {
  userYears: number | null;
  listing: ChanceSource;
  compact?: boolean;
}) {
  const t = useTranslations("chance");
  const locale = useLocale() as Locale;
  const range = chanceRange(listing);
  const c = chanceFor(userYears, range?.q1, range?.q3);
  const isAverage = listing.kotidQ1 == null && listing.kotidSnitt != null;
  const user = userYears != null ? t("meterUser", { years: formatYearsShort(userYears, locale) }) : "";
  // Snittet säger inget om percentiler, så där gäller egna formuleringar.
  const hint = isAverage && c.level !== "unknown" ? t(`avg.${c.level}.hint`) : t(`${c.level}.hint`);

  const title = !range
    ? hint
    : isAverage
      ? t("averageTitle", { hint, years: formatYearsShort(listing.kotidSnitt!, locale), user })
      : t("meterTitle", { hint, q1: listing.kotidQ1!, q3: listing.kotidQ3!, user });

  return (
    <div className="flex items-center gap-2.5" title={title}>
      <span className={`chip shrink-0 ${c.pill}`}>
        <span className={`size-1.5 rounded-full ${c.dot}`} />
        {t(`${c.level}.label`)}
      </span>
      {range && (
        <div className="relative h-1.5 min-w-16 flex-1 rounded-full bg-slate-100">
          <div className="absolute inset-y-0 rounded-full bg-slate-300/80" style={{ left: pct(range.q1), width: `calc(${pct(range.q3)} - ${pct(range.q1)})` }}>
            {/* Tredjedelsmarkeringar: början / mitten / slutet av spannet */}
            <span className="absolute inset-y-0 left-1/3 w-px bg-white/90" />
            <span className="absolute inset-y-0 left-2/3 w-px bg-white/90" />
          </div>
          {userYears != null && (
            <span
              className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm ${c.dot}`}
              style={{ left: pct(userYears) }}
            />
          )}
        </div>
      )}
      {!compact && range && (
        <span className="shrink-0 text-xs text-muted">
          {isAverage ? t("average", { years: formatYearsShort(listing.kotidSnitt!, locale) }) : t("range", { q1: listing.kotidQ1!, q3: listing.kotidQ3! })}
        </span>
      )}
    </div>
  );
}

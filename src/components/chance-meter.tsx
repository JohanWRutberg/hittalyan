"use client";

import { useLocale, useTranslations } from "next-intl";
import { applicantsAhead, chanceFor, chanceFromApplicants, chanceRange, type Chance, type ChanceSource } from "@/lib/chance";
import { formatYearsShort } from "@/lib/format";
import type { Locale } from "@/i18n/config";

/** Skala för mätaren i år. Allt över klipps mot höger kant. */
const SCALE_YEARS = 20;
// Avrundat: flyttalsbrus i style-attributet ger annars skillnader mellan
// serverns och webbläsarens sträng.
const pct = (y: number) => `${Math.min(100, Math.max(0, (y / SCALE_YEARS) * 100)).toFixed(3)}%`;

const YEAR_MS = 365.25 * 86_400_000;

export interface ChanceProps {
  /** Ködatum, för jämförelse mot de sökande. Datum mot datum, alltså tidsoberoende. */
  userRegisteredAt: Date | null;
  /**
   * Kötiden i år, **uträknad på servern**. Får inte räknas fram här: den bygger
   * på `Date.now()` och skulle ge ett annat värde vid hydrering än i den
   * serverrenderade HTML:en – och dessutom skilja sig mellan korten.
   */
  userYears: number | null;
  listing: ChanceSource;
}

/**
 * Bedömningen bakom både stapeln och etiketten. Vet vi vilka som faktiskt sökt
 * är det ett bättre mått än historiken, som beskriver liknande lägenheter i
 * stort och inte kön kring just den här bostaden.
 */
function assess({ userRegisteredAt, userYears, listing }: ChanceProps): {
  chance: Chance;
  /** Kötider i år för de kända sökande, uträknade relativt användaren så att
   *  de blir tidsoberoende precis som `userYears`. */
  applicantYears: number[];
  ahead: number;
  range: { q1: number; q3: number } | null;
} {
  const dates = listing.queueDates ?? [];
  const range = chanceRange(listing);

  if (dates.length && userRegisteredAt && userYears != null) {
    const applicantYears = dates.map((d) => userYears + (userRegisteredAt.getTime() - d.getTime()) / YEAR_MS);
    return {
      chance: chanceFromApplicants(dates, userRegisteredAt),
      applicantYears,
      ahead: applicantsAhead(dates, userRegisteredAt),
      range,
    };
  }
  return { chance: chanceFor(userYears, range?.q1, range?.q3), applicantYears: [], ahead: 0, range };
}

/**
 * Stapeln, i kortets fulla bredd. Visar var användaren står: mot de faktiska
 * sökande när vi känner dem, annars mot kötidsspannet för liknande lägenheter.
 *
 * Förmedlingar som varken publicerar kötidsstatistik eller sökandes kötider
 * (Boplats Syd, Uppsala) får ingen stapel – det finns inget att visa.
 */
export function ChanceBar({ userRegisteredAt, userYears, listing }: ChanceProps) {
  const t = useTranslations("chance");
  const locale = useLocale() as Locale;
  const { chance, applicantYears, range } = assess({ userRegisteredAt, userYears, listing });
  if (!applicantYears.length && !range) return null;

  return (
    <div
      className="relative h-1.5 w-full bg-subtle"
      title={
        applicantYears.length
          ? t("barApplicants")
          : t("barRange", { q1: formatYearsShort(range!.q1, locale), q3: formatYearsShort(range!.q3, locale) })
      }
    >
      {/* Historiskt spann: där hälften av dem som fått liknande lägenheter låg. */}
      {!applicantYears.length && range && (
        <div
          className="absolute inset-y-0 bg-faint/50"
          style={{ left: pct(range.q1), width: `calc(${pct(range.q3)} - ${pct(range.q1)})` }}
        />
      )}

      {/* De vi faktiskt tävlar mot, som streck. */}
      {applicantYears.map((y, i) => (
        <span key={i} className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-faint" style={{ left: pct(y) }} />
      ))}

      {userYears != null && (
        <span
          className={`absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface ${chance.dot}`}
          style={{ left: pct(userYears) }}
        />
      )}
    </div>
  );
}

/** Den lilla etiketten, med en kort förklaring bredvid. */
export function ChanceChip({ userRegisteredAt, userYears, listing }: ChanceProps) {
  const t = useTranslations("chance");
  const locale = useLocale() as Locale;
  const { chance, applicantYears, ahead, range } = assess({ userRegisteredAt, userYears, listing });

  const detail = applicantYears.length
    ? `${ahead === 0 ? t("applicants.none") : t("applicants.some", { count: ahead })} · ${t("applicants.longest", {
        year: (listing.queueDates ?? [])[0].getUTCFullYear(),
      })}`
    : range
      ? listing.kotidQ1 != null
        ? t("range", { q1: listing.kotidQ1, q3: listing.kotidQ3! })
        : t("average", { years: formatYearsShort(listing.kotidSnitt!, locale) })
      : "";

  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${chance.pill}`}>
        <span className={`size-1.5 rounded-full ${chance.dot}`} />
        {t(`${chance.level}.label`)}
      </span>
      {detail && <span className="truncate text-[11px] text-muted">{detail}</span>}
    </div>
  );
}

/**
 * Bedömning av chansen att få en lägenhet, baserat på användarens kötid jämfört
 * med förmedlingens statistik. Etiketterna översätts i UI:t via chance.<level>.
 *
 * Underlaget skiljer sig åt mellan förmedlingarna:
 * - Stockholm anger kvartil 1 och 3 för liknande lägenheter. Q1–Q3 är spannet där
 *   hälften av dem som fått en liknande lägenhet låg.
 * - Boplats Väst anger bara en genomsnittlig kötid för området. Den läggs i mitten
 *   av ett antaget spann, så att mätaren kan visas på samma sätt.
 * - Boplats Syd och Uppsala har ingen kötidsstatistik alls, bara antal sökande.
 *   Där visas antalet i stället för en bedömning.
 */

export type ChanceLevel = "excellent" | "great" | "good" | "some" | "slim" | "low" | "unknown";

export interface Chance {
  level: ChanceLevel;
  /** Tailwind-klasser för pill */
  pill: string;
  /** Tailwind bakgrund för prick */
  dot: string;
  /** 0–5, för sortering */
  rank: number;
}

const STYLES: Record<ChanceLevel, Omit<Chance, "level">> = {
  excellent: { pill: "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", dot: "bg-emerald-600 dark:bg-emerald-400", rank: 5 },
  great: { pill: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400", dot: "bg-emerald-500", rank: 4 },
  good: { pill: "border-accent-line bg-accent-soft text-accent", dot: "bg-brand-500", rank: 3 },
  some: { pill: "border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-800 dark:bg-lime-950 dark:text-lime-300", dot: "bg-lime-500", rank: 2 },
  slim: { pill: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300", dot: "bg-amber-500", rank: 1 },
  low: { pill: "border-line bg-subtle text-muted", dot: "bg-faint", rank: 0 },
  unknown: { pill: "border-line bg-surface text-muted", dot: "bg-faint", rank: -1 },
};

/** Fälten en annons bidrar med till bedömningen. */
export interface ChanceSource {
  kotidQ1: number | null;
  kotidQ3: number | null;
  kotidSnitt: number | null;
  /** Kötider bland dem som faktiskt sökt, tidigast registreringsdatum först. */
  queueDates?: Date[];
}

/**
 * Hur många av de kända sökande som har längre kötid än användaren.
 * Ett tidigare registreringsdatum betyder längre kötid.
 */
export function applicantsAhead(queueDates: Date[], userRegisteredAt: Date): number {
  return queueDates.filter((d) => d.getTime() < userRegisteredAt.getTime()).length;
}

/**
 * Bedömning utifrån dem som faktiskt sökt annonsen. Förmedlingen publicerar bara
 * de tre längsta kötiderna, så vi kan inte räkna fram en exakt placering – men vi
 * vet om användaren slår dem eller inte, vilket är det som avgör.
 *
 * Det här är ett bättre mått än historiken: den beskriver liknande lägenheter som
 * förmedlats tidigare, inte den kö som bildats kring just den här bostaden. En
 * attraktiv bostad drar till sig sökande med långt över snittets kötid.
 */
export function chanceFromApplicants(queueDates: Date[], userRegisteredAt: Date): Chance {
  const ahead = applicantsAhead(queueDates, userRegisteredAt);
  const level: ChanceLevel = ahead === 0 ? "excellent" : ahead === 1 ? "great" : ahead === 2 ? "good" : "slim";
  return { level, ...STYLES[level] };
}

/**
 * Hur brett spann ett enskilt snitt får representera. Boplats Väst redovisar en
 * genomsnittlig kötid, inte en spridning, så mätaren visar snittet ±25 %.
 */
const AVERAGE_SPREAD = 0.25;

/** Spannet att visa i mätaren, eller null när förmedlingen saknar kötidsstatistik. */
export function chanceRange(l: ChanceSource): { q1: number; q3: number } | null {
  if (l.kotidQ1 != null && l.kotidQ3 != null) return { q1: l.kotidQ1, q3: l.kotidQ3 };
  if (l.kotidSnitt != null) {
    return { q1: l.kotidSnitt * (1 - AVERAGE_SPREAD), q3: l.kotidSnitt * (1 + AVERAGE_SPREAD) };
  }
  return null;
}

/** Kötid i år (decimal) från registreringsdatum. */
export function queueYears(registeredAt: Date | string, now = new Date()): number {
  const t = typeof registeredAt === "string" ? new Date(registeredAt).getTime() : registeredAt.getTime();
  return Math.max(0, (now.getTime() - t) / (365.25 * 86_400_000));
}

export function chanceFor(userYears: number | null | undefined, q1: number | null | undefined, q3: number | null | undefined): Chance {
  if (userYears == null || q1 == null || q3 == null) return { level: "unknown", ...STYLES.unknown };
  let level: ChanceLevel;
  if (userYears >= q3) level = "excellent";
  else if (userYears < q1 - 2) level = "low";
  else if (userYears < q1) level = "slim";
  else {
    const span = Math.max(q3 - q1, 0.0001);
    const p = (userYears - q1) / span;
    level = p >= 2 / 3 ? "great" : p >= 1 / 3 ? "good" : "some";
  }
  return { level, ...STYLES[level] };
}

/**
 * Bedömning av chansen att få en lägenhet, baserat på användarens kötid jämfört med
 * Bostadsförmedlingens statistik för liknande lägenheter (kvartil 1 och 3 i år).
 * Q1–Q3 är spannet där hälften av dem som fått liknande lägenheter låg.
 */

export type ChanceLevel = "great" | "good" | "slim" | "low" | "unknown";

export interface Chance {
  level: ChanceLevel;
  label: string;
  /** Tailwind-klasser för pill */
  pill: string;
  /** Tailwind bakgrund för prick/segment */
  dot: string;
}

const LEVELS: Record<ChanceLevel, Omit<Chance, "level">> = {
  great: { label: "Mycket god chans", pill: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  good: { label: "God chans", pill: "border-brand-200 bg-brand-50 text-brand-700", dot: "bg-brand-500" },
  slim: { label: "Liten chans", pill: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  low: { label: "Låg chans", pill: "border-slate-200 bg-slate-50 text-slate-500", dot: "bg-slate-400" },
  unknown: { label: "Okänd chans", pill: "border-line bg-white text-muted", dot: "bg-slate-300" },
};

/** Kötid i år (decimal) från registreringsdatum. */
export function queueYears(registeredAt: Date | string, now = new Date()): number {
  const t = typeof registeredAt === "string" ? new Date(registeredAt).getTime() : registeredAt.getTime();
  return Math.max(0, (now.getTime() - t) / (365.25 * 86_400_000));
}

export function chanceFor(userYears: number | null | undefined, q1: number | null | undefined, q3: number | null | undefined): Chance {
  if (userYears == null || q1 == null || q3 == null) return { level: "unknown", ...LEVELS.unknown };
  let level: ChanceLevel;
  if (userYears >= q3) level = "great";
  else if (userYears >= q1) level = "good";
  else if (userYears >= q1 - 2) level = "slim";
  else level = "low";
  return { level, ...LEVELS[level] };
}

export const formatYears = (y: number) => `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(y)} år`;

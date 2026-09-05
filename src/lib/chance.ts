/**
 * Bedömning av chansen att få en lägenhet, baserat på användarens kötid jämfört med
 * Bostadsförmedlingens statistik för liknande lägenheter (kvartil 1 och 3 i år).
 * Q1–Q3 är spannet där hälften av dem som fått liknande lägenheter låg:
 * 25 % hade kortare kötid än Q1 och 25 % längre än Q3.
 *
 * Nivåer (userYears = egen kötid, p = position i spannet 0..1):
 *   excellent  userYears >= Q3        längre kö än 75 % av dem som fått liknande
 *   great      p >= 2/3               övre tredjedelen av spannet
 *   good       1/3 <= p < 2/3         mitten av spannet
 *   some       0 <= p < 1/3           början av spannet
 *   slim       Q1 - 2 <= userYears < Q1
 *   low        userYears < Q1 - 2
 */

export type ChanceLevel = "excellent" | "great" | "good" | "some" | "slim" | "low" | "unknown";

export interface Chance {
  level: ChanceLevel;
  label: string;
  /** Kort förklaring för tooltip */
  hint: string;
  /** Tailwind-klasser för pill */
  pill: string;
  /** Tailwind bakgrund för prick */
  dot: string;
  /** 0..5, för sortering och ev. stapel */
  rank: number;
}

const LEVELS: Record<ChanceLevel, Omit<Chance, "level">> = {
  excellent: {
    label: "Utmärkt chans",
    hint: "Din kötid är längre än hos 75 % av dem som fått liknande lägenheter.",
    pill: "border-emerald-300 bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-600",
    rank: 5,
  },
  great: {
    label: "Mycket god chans",
    hint: "Du ligger i slutet av spannet för dem som fått liknande lägenheter.",
    pill: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    rank: 4,
  },
  good: {
    label: "God chans",
    hint: "Du ligger mitt i spannet för dem som fått liknande lägenheter.",
    pill: "border-brand-200 bg-brand-50 text-brand-700",
    dot: "bg-brand-500",
    rank: 3,
  },
  some: {
    label: "Viss chans",
    hint: "Du ligger i början av spannet. Ungefär var fjärde som fått liknande hade kortare kötid än så.",
    pill: "border-lime-200 bg-lime-50 text-lime-700",
    dot: "bg-lime-500",
    rank: 2,
  },
  slim: {
    label: "Liten chans",
    hint: "Din kötid är upp till två år kortare än spannets nedre gräns.",
    pill: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    rank: 1,
  },
  low: {
    label: "Låg chans",
    hint: "Din kötid är mer än två år kortare än spannets nedre gräns.",
    pill: "border-slate-200 bg-slate-50 text-slate-500",
    dot: "bg-slate-400",
    rank: 0,
  },
  unknown: {
    label: "Okänd chans",
    hint: "Bostadsförmedlingen saknar statistik för den här annonsen, eller så har du inte angett ködatum.",
    pill: "border-line bg-white text-muted",
    dot: "bg-slate-300",
    rank: -1,
  },
};

/** Kötid i år (decimal) från registreringsdatum. */
export function queueYears(registeredAt: Date | string, now = new Date()): number {
  const t = typeof registeredAt === "string" ? new Date(registeredAt).getTime() : registeredAt.getTime();
  return Math.max(0, (now.getTime() - t) / (365.25 * 86_400_000));
}

export function chanceFor(userYears: number | null | undefined, q1: number | null | undefined, q3: number | null | undefined): Chance {
  if (userYears == null || q1 == null || q3 == null) return { level: "unknown", ...LEVELS.unknown };
  let level: ChanceLevel;
  if (userYears >= q3) level = "excellent";
  else if (userYears < q1 - 2) level = "low";
  else if (userYears < q1) level = "slim";
  else {
    const span = Math.max(q3 - q1, 0.0001);
    const p = (userYears - q1) / span;
    level = p >= 2 / 3 ? "great" : p >= 1 / 3 ? "good" : "some";
  }
  return { level, ...LEVELS[level] };
}

export const CHANCE_LEVELS_IN_ORDER: ChanceLevel[] = ["excellent", "great", "good", "some", "slim", "low"];
export const chanceInfo = (level: ChanceLevel) => ({ level, ...LEVELS[level] });

export const formatYears = (y: number) => `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(y)} år`;

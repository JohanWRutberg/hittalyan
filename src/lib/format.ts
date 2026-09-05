import { intlTag, type Locale } from "@/i18n/config";

/**
 * Formatering av tal, datum och enheter. Alla funktioner tar ett språk (sv/en)
 * och används både i React och i mail/push där next-intl inte finns.
 */

const UNITS = {
  sv: { rok: "rok", room: "rum", rooms: "rum", floor: "vån", ground: "BV", year: "år", years: "år" },
  en: { rok: "rooms", room: "room", rooms: "rooms", floor: "floor", ground: "GF", year: "year", years: "years" },
} as const;

const num = (locale: Locale, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(intlTag(locale), opts);

export const formatNumber = (n: number, locale: Locale = "sv") => num(locale).format(n);

export const formatKr = (n: number | null | undefined, locale: Locale = "sv") =>
  n == null ? "–" : `${num(locale).format(n)} kr`;

export const formatRum = (n: number | null | undefined, locale: Locale = "sv") => {
  if (n == null) return "–";
  const u = UNITS[locale];
  return locale === "sv" ? `${num(locale).format(n)} ${u.rok}` : `${num(locale).format(n)} ${n === 1 ? u.room : u.rooms}`;
};

export const formatYta = (n: number | null | undefined) => (n == null ? "–" : `${n} m²`);

export const formatVaning = (n: number | null | undefined, locale: Locale = "sv") => {
  const u = UNITS[locale];
  return n == null ? "–" : n === 0 ? u.ground : `${u.floor} ${n}`;
};

export const formatYearsShort = (y: number, locale: Locale = "sv") =>
  `${num(locale, { maximumFractionDigits: 1 }).format(y)} ${UNITS[locale].years}`;

const toDate = (d: Date | string) => (typeof d === "string" ? new Date(d) : d);

export const formatDate = (d: Date | string | null | undefined, locale: Locale = "sv") =>
  d ? new Intl.DateTimeFormat(intlTag(locale), { dateStyle: "medium" }).format(toDate(d)) : "–";

export const formatDateTime = (d: Date | string | null | undefined, locale: Locale = "sv") =>
  d ? new Intl.DateTimeFormat(intlTag(locale), { dateStyle: "medium", timeStyle: "short" }).format(toDate(d)) : "–";

/** Antal år och dagar sedan ett datum, t.ex. { years: 4, days: 112, totalDays: 1573 } */
export function queueTime(registeredAt: Date, now = new Date()) {
  const msPerDay = 86_400_000;
  const totalDays = Math.max(0, Math.floor((now.getTime() - registeredAt.getTime()) / msPerDay));
  let years = now.getFullYear() - registeredAt.getFullYear();
  const anniversary = new Date(registeredAt);
  anniversary.setFullYear(registeredAt.getFullYear() + years);
  if (anniversary > now) {
    years -= 1;
    anniversary.setFullYear(registeredAt.getFullYear() + years);
  }
  const days = Math.floor((now.getTime() - anniversary.getTime()) / msPerDay);
  return { years, days, totalDays };
}

export const DAY_MS = 86_400_000;

/** Tidpunkt 24 h bakåt – för "nya annonser". */
export function dayAgo(): Date {
  return new Date(Date.now() - DAY_MS);
}

export function isRecent(d: Date | string, hours = 24): boolean {
  const t = typeof d === "string" ? new Date(d).getTime() : d.getTime();
  return Date.now() - t < hours * 3_600_000;
}

export function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3_600_000);
}

export const formatKr = (n: number | null | undefined) =>
  n == null ? "–" : `${new Intl.NumberFormat("sv-SE").format(n)} kr`;

export const formatRum = (n: number | null | undefined) =>
  n == null ? "–" : `${new Intl.NumberFormat("sv-SE").format(n)} rok`;

export const formatYta = (n: number | null | undefined) => (n == null ? "–" : `${n} m²`);

export const formatVaning = (n: number | null | undefined) =>
  n == null ? "–" : n === 0 ? "BV" : `vån ${n}`;

export const formatDate = (d: Date | string | null | undefined) => {
  if (!d) return "–";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium" }).format(date);
};

export const formatDateTime = (d: Date | string | null | undefined) => {
  if (!d) return "–";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

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

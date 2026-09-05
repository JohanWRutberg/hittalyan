import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { dayAgo } from "@/lib/format";
import { splitAddressTerms } from "@/lib/matching";

const num = z.preprocess((v) => {
  if (v === "" || v == null) return undefined;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}, z.number().optional());

const bool = z.preprocess((v) => (v === "on" || v === "true" || v === "1" ? true : undefined), z.boolean().optional());

const list = z.preprocess((v) => {
  if (v == null || v === "") return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.flatMap((s) => String(s).split(",")).map((s) => s.trim()).filter(Boolean);
}, z.array(z.string()));

export const filterSchema = z.object({
  kommuner: list,
  stadsdelar: list,
  adress: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().max(500).optional()),
  minRum: num,
  maxRum: num,
  minYta: num,
  maxYta: num,
  minHyra: num,
  maxHyra: num,
  minVaning: num,
  maxVaning: num,
  balkong: bool,
  hiss: bool,
  nyproduktion: bool,
  inkluderaUngdom: bool,
  inkluderaStudent: bool,
  inkluderaSenior: bool,
  inkluderaKorttid: bool,
  nya: bool, // bara annonser upptäckta senaste 24h
});

export type Filters = z.infer<typeof filterSchema>;

export type SearchParams = Record<string, string | string[] | undefined>;

export function parseFilters(sp: SearchParams | FormData): Filters {
  const obj: Record<string, unknown> = {};
  if (sp instanceof FormData) {
    for (const key of new Set(sp.keys())) {
      const all = sp.getAll(key).map(String);
      obj[key] = all.length > 1 ? all : all[0];
    }
  } else {
    Object.assign(obj, sp);
  }
  const parsed = filterSchema.safeParse(obj);
  return parsed.success ? parsed.data : filterSchema.parse({});
}

export function filtersToQuery(f: Partial<Filters>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v == null || v === false || v === "" || (Array.isArray(v) && !v.length)) continue;
    if (Array.isArray(v)) p.set(k, v.join(","));
    else p.set(k, String(v));
  }
  return p.toString();
}

export function countActiveFilters(f: Filters): number {
  return Object.entries(f).filter(([, v]) => v != null && v !== false && !(Array.isArray(v) && !v.length)).length;
}

export function filtersToWhere(f: Filters): Prisma.ListingWhereInput {
  const and: Prisma.ListingWhereInput[] = [{ active: true }];
  if (f.kommuner.length) and.push({ kommun: { in: f.kommuner, mode: "insensitive" } });
  if (f.stadsdelar.length) and.push({ stadsdel: { in: f.stadsdelar, mode: "insensitive" } });
  if (f.adress) {
    const terms = splitAddressTerms(f.adress);
    if (terms.length) {
      and.push({
        OR: terms.flatMap((t) => [
          { gatuadress: { contains: t, mode: "insensitive" as const } },
          { stadsdel: { contains: t, mode: "insensitive" as const } },
          { kommun: { contains: t, mode: "insensitive" as const } },
        ]),
      });
    }
  }
  if (f.minRum != null) and.push({ antalRum: { gte: f.minRum } });
  if (f.maxRum != null) and.push({ antalRum: { lte: f.maxRum } });
  if (f.minYta != null) and.push({ yta: { gte: f.minYta } });
  if (f.maxYta != null) and.push({ yta: { lte: f.maxYta } });
  if (f.minHyra != null) and.push({ hyra: { gte: f.minHyra } });
  if (f.maxHyra != null) and.push({ hyra: { lte: f.maxHyra } });
  if (f.minVaning != null) and.push({ vaning: { gte: f.minVaning } });
  if (f.maxVaning != null) and.push({ vaning: { lte: f.maxVaning } });
  if (f.balkong) and.push({ balkong: true });
  if (f.hiss) and.push({ hiss: true });
  if (f.nyproduktion) and.push({ nyproduktion: true });
  if (!f.inkluderaUngdom) and.push({ ungdom: false });
  if (!f.inkluderaStudent) and.push({ student: false });
  if (!f.inkluderaSenior) and.push({ senior: false });
  if (!f.inkluderaKorttid) and.push({ korttid: false });
  if (f.nya) and.push({ firstSeenAt: { gte: dayAgo() } });
  return { AND: and };
}

/** Kommun -> sorterade stadsdelar, från aktiva annonser + kända kommuner. */
export type AreaMap = Record<string, string[]>;

export const KNOWN_KOMMUNER = [
  "Botkyrka", "Danderyd", "Ekerö", "Haninge", "Huddinge", "Järfälla", "Lidingö", "Nacka", "Norrtälje", "Nykvarn",
  "Nynäshamn", "Salem", "Sigtuna", "Sollentuna", "Solna", "Stockholm", "Sundbyberg", "Södertälje", "Tyresö", "Täby",
  "Upplands Väsby", "Upplands-Bro", "Vallentuna", "Vaxholm", "Värmdö", "Österåker",
];

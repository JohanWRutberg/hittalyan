import type { Prisma } from "@/generated/prisma/client";
import type { SearchParams } from "@/lib/filters";
import { marketInfo, type Market } from "@/lib/markets";

export type SortKey = "nyast" | "hyra" | "rum" | "yta" | "vaning" | "sistadag" | "kotid" | "sokande";
export type SortDir = "asc" | "desc";

export interface SortOption {
  key: SortKey;
  /** Riktning vid första klick. Etiketter finns i ordlistan under sort.options.<key> */
  defaultDir: SortDir;
}

export const SORT_OPTIONS: SortOption[] = [
  { key: "nyast", defaultDir: "desc" },
  { key: "hyra", defaultDir: "asc" },
  { key: "rum", defaultDir: "desc" },
  { key: "yta", defaultDir: "desc" },
  { key: "vaning", defaultDir: "desc" },
  { key: "sistadag", defaultDir: "asc" },
  { key: "kotid", defaultDir: "asc" },
  { key: "sokande", defaultDir: "asc" },
];

/**
 * Sorteringar som är meningsfulla hos en viss förmedling. Momentum-plattformen
 * (Syd, Uppsala) lämnar inte ut våningsplan och har ingen kötidsstatistik, men
 * anger antal sökande. Boplats Väst har båda delarna.
 */
export function sortOptionsFor(market: Market): SortOption[] {
  const info = marketInfo(market);
  return SORT_OPTIONS.filter((o) => {
    if (o.key === "vaning") return info.hasFloor;
    if (o.key === "kotid") return info.chance !== "applicants";
    if (o.key === "sokande") return info.chance !== "quartiles";
    return true;
  });
}

export interface Sort {
  key: SortKey;
  dir: SortDir;
}

export const DEFAULT_SORTS: Sort[] = [{ key: "nyast", dir: "desc" }];

export const optionFor = (key: SortKey) => SORT_OPTIONS.find((o) => o.key === key)!;

/**
 * Flera sorteringsnivåer i prioritetsordning, t.ex. ?sort=yta:desc,hyra:asc
 * = störst yta först, och bland lika stora den billigaste först.
 */
export function parseSorts(sp: SearchParams, market: Market): Sort[] {
  const raw = Array.isArray(sp.sort) ? sp.sort.join(",") : (sp.sort ?? "");
  const available = sortOptionsFor(market);
  const sorts: Sort[] = [];
  for (const part of raw.split(",")) {
    const [k, d] = part.split(":");
    const opt = available.find((o) => o.key === k);
    if (!opt || sorts.some((s) => s.key === opt.key)) continue;
    sorts.push({ key: opt.key, dir: d === "asc" || d === "desc" ? d : opt.defaultDir });
  }
  return sorts.length ? sorts : DEFAULT_SORTS;
}

export const isDefaultSorts = (sorts: Sort[]) =>
  sorts.length === 1 && sorts[0].key === DEFAULT_SORTS[0].key && sorts[0].dir === DEFAULT_SORTS[0].dir;

function orderFor(sort: Sort, market: Market): Prisma.ListingOrderByWithRelationInput[] {
  const nullsLast = { sort: sort.dir, nulls: "last" as const };
  switch (sort.key) {
    case "hyra":
      return [{ hyra: nullsLast }];
    case "rum":
      return [{ antalRum: nullsLast }];
    case "yta":
      return [{ yta: nullsLast }];
    case "vaning":
      return [{ vaning: nullsLast }];
    case "sistadag":
      return [{ annonseradTill: nullsLast }];
    case "kotid":
      // Väst har ett områdessnitt i stället för kvartiler.
      return marketInfo(market).chance === "average" ? [{ kotidSnitt: nullsLast }] : [{ kotidQ1: nullsLast }, { kotidQ3: nullsLast }];
    case "sokande":
      return [{ sokande: nullsLast }];
    case "nyast":
    default:
      return [{ firstSeenAt: sort.dir }];
  }
}

export function sortsToOrderBy(sorts: Sort[], market: Market): Prisma.ListingOrderByWithRelationInput[] {
  return [...sorts.flatMap((s) => orderFor(s, market)), { id: "desc" }];
}

/** Bygger en query-sträng med ny sortering, behåller filter, nollställer sida. */
export function withSorts(sp: SearchParams, next: Sort[]): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v == null || k === "sida" || k === "sort" || k === "dir") continue;
    if (Array.isArray(v)) v.forEach((x) => q.append(k, x));
    else q.set(k, v);
  }
  if (next.length && !isDefaultSorts(next)) {
    q.set("sort", next.map((s) => (s.dir === optionFor(s.key).defaultDir ? s.key : `${s.key}:${s.dir}`)).join(","));
  }
  return q.toString();
}

import type { Prisma } from "@/generated/prisma/client";
import type { SearchParams } from "@/lib/filters";

export type SortKey = "nyast" | "hyra" | "rum" | "yta" | "vaning" | "sistadag" | "kotid";
export type SortDir = "asc" | "desc";

export interface SortOption {
  key: SortKey;
  label: string;
  /** Riktning vid första klick */
  defaultDir: SortDir;
  asc: string;
  desc: string;
}

export const SORT_OPTIONS: SortOption[] = [
  { key: "nyast", label: "Inkommet", defaultDir: "desc", desc: "Nyast först", asc: "Äldst först" },
  { key: "hyra", label: "Hyra", defaultDir: "asc", asc: "Lägst först", desc: "Högst först" },
  { key: "rum", label: "Rum", defaultDir: "desc", desc: "Flest först", asc: "Färst först" },
  { key: "yta", label: "Yta", defaultDir: "desc", desc: "Störst först", asc: "Minst först" },
  { key: "vaning", label: "Våning", defaultDir: "desc", desc: "Högst upp först", asc: "Lägst först" },
  { key: "sistadag", label: "Sista dag", defaultDir: "asc", asc: "Snarast först", desc: "Senast först" },
  { key: "kotid", label: "Kötid som krävs", defaultDir: "asc", asc: "Kortast först", desc: "Längst först" },
];

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
export function parseSorts(sp: SearchParams): Sort[] {
  const raw = Array.isArray(sp.sort) ? sp.sort.join(",") : (sp.sort ?? "");
  const sorts: Sort[] = [];
  for (const part of raw.split(",")) {
    const [k, d] = part.split(":");
    const opt = SORT_OPTIONS.find((o) => o.key === k);
    if (!opt || sorts.some((s) => s.key === opt.key)) continue;
    sorts.push({ key: opt.key, dir: d === "asc" || d === "desc" ? d : opt.defaultDir });
  }
  return sorts.length ? sorts : DEFAULT_SORTS;
}

export const isDefaultSorts = (sorts: Sort[]) =>
  sorts.length === 1 && sorts[0].key === DEFAULT_SORTS[0].key && sorts[0].dir === DEFAULT_SORTS[0].dir;

function orderFor(sort: Sort): Prisma.ListingOrderByWithRelationInput[] {
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
      return [{ kotidQ1: nullsLast }, { kotidQ3: nullsLast }];
    case "nyast":
    default:
      return [{ firstSeenAt: sort.dir }];
  }
}

export function sortsToOrderBy(sorts: Sort[]): Prisma.ListingOrderByWithRelationInput[] {
  return [...sorts.flatMap(orderFor), { id: "desc" }];
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

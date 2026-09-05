import type { Prisma } from "@/generated/prisma/client";
import type { SearchParams } from "@/lib/filters";

export type SortKey = "nyast" | "hyra" | "rum" | "yta" | "vaning" | "sistadag" | "kotid";
export type SortDir = "asc" | "desc";

export interface SortOption {
  key: SortKey;
  label: string;
  /** Riktning vid första klick */
  defaultDir: SortDir;
  /** Etiketter för riktningarna, används i pillret */
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

export const DEFAULT_SORT: Sort = { key: "nyast", dir: "desc" };

export function parseSort(sp: SearchParams): Sort {
  const key = SORT_OPTIONS.find((o) => o.key === sp.sort)?.key ?? DEFAULT_SORT.key;
  const opt = SORT_OPTIONS.find((o) => o.key === key)!;
  const dir: SortDir = sp.dir === "asc" || sp.dir === "desc" ? sp.dir : opt.defaultDir;
  return { key, dir };
}

export function sortToOrderBy(sort: Sort): Prisma.ListingOrderByWithRelationInput[] {
  const nullsLast = { sort: sort.dir, nulls: "last" as const };
  switch (sort.key) {
    case "hyra":
      return [{ hyra: nullsLast }, { id: "desc" }];
    case "rum":
      return [{ antalRum: nullsLast }, { yta: nullsLast }, { id: "desc" }];
    case "yta":
      return [{ yta: nullsLast }, { id: "desc" }];
    case "vaning":
      return [{ vaning: nullsLast }, { id: "desc" }];
    case "sistadag":
      return [{ annonseradTill: nullsLast }, { id: "desc" }];
    case "kotid":
      return [{ kotidQ1: nullsLast }, { kotidQ3: nullsLast }, { id: "desc" }];
    case "nyast":
    default:
      return [{ firstSeenAt: sort.dir }, { id: sort.dir }];
  }
}

/** Bygger en query-sträng med ny sortering, behåller filter, nollställer sida. */
export function withSort(sp: SearchParams, next: Sort): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v == null || k === "sida" || k === "sort" || k === "dir") continue;
    if (Array.isArray(v)) v.forEach((x) => q.append(k, x));
    else q.set(k, v);
  }
  if (next.key !== DEFAULT_SORT.key) q.set("sort", next.key);
  const opt = SORT_OPTIONS.find((o) => o.key === next.key)!;
  if (next.dir !== opt.defaultDir) q.set("dir", next.dir);
  return q.toString();
}

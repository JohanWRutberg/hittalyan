import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { KNOWN_KOMMUNER, type AreaMap } from "@/lib/filters";
import type { Market } from "@/lib/markets";
import omradenJson from "@/data/omraden.json";

const STATIC: Record<string, string[]> = omradenJson;

/**
 * Kommun -> stadsdelar för en förmedling. Stockholm har ett komplett register
 * (src/data/omraden.json, uppdateras med scripts/fetch-omraden.mjs). Övriga
 * förmedlingar publicerar inget register, så deras områden byggs av de namn som
 * faktiskt förekommit i annonserna.
 */
export async function getAreaMap(market: Market): Promise<AreaMap> {
  const rows = await prisma.listing.findMany({
    where: { market },
    distinct: ["kommun", "stadsdel"],
    select: { kommun: true, stadsdel: true },
  });
  // Registret innehåller även kommuner utanför länet (Kiruna, Uppsala …). Visa bara
  // Stockholms län plus kommuner som faktiskt förekommit i annonser.
  const map: Record<string, Set<string>> = {};
  if (market === "stockholm") {
    for (const [k, list] of Object.entries(STATIC)) if (KNOWN_KOMMUNER.includes(k)) map[k] = new Set(list);
  }
  for (const r of rows) {
    if (!r.kommun) continue;
    (map[r.kommun] ??= new Set(market === "stockholm" ? (STATIC[r.kommun] ?? []) : []));
    if (r.stadsdel) map[r.kommun].add(r.stadsdel);
  }
  return Object.fromEntries(
    Object.keys(map)
      .sort((a, b) => a.localeCompare(b, "sv"))
      .map((k) => [k, [...map[k]].sort((a, b) => a.localeCompare(b, "sv"))]),
  );
}

export interface AreaCounts {
  /** kommun -> antal annonser */
  kommun: Record<string, number>;
  /** "kommun|stadsdel" -> antal annonser */
  stadsdel: Record<string, number>;
}

export const stadsdelKey = (kommun: string, stadsdel: string) => `${kommun}|${stadsdel}`;

/** Antal annonser per kommun och stadsdel för ett givet where (utan kommun/stadsdel-villkor). */
export async function getAreaCounts(where: Prisma.ListingWhereInput): Promise<AreaCounts> {
  const groups = await prisma.listing.groupBy({
    by: ["kommun", "stadsdel"],
    where,
    _count: { _all: true },
  });
  const counts: AreaCounts = { kommun: {}, stadsdel: {} };
  for (const g of groups) {
    counts.kommun[g.kommun] = (counts.kommun[g.kommun] ?? 0) + g._count._all;
    counts.stadsdel[stadsdelKey(g.kommun, g.stadsdel)] = g._count._all;
  }
  return counts;
}

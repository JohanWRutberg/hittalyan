import { prisma } from "@/lib/prisma";
import { KNOWN_KOMMUNER, type AreaMap } from "@/lib/filters";

export async function getAreaMap(): Promise<AreaMap> {
  const rows = await prisma.listing.findMany({
    distinct: ["kommun", "stadsdel"],
    select: { kommun: true, stadsdel: true },
    orderBy: [{ kommun: "asc" }, { stadsdel: "asc" }],
  });
  const map: AreaMap = {};
  for (const k of KNOWN_KOMMUNER) map[k] = [];
  for (const r of rows) {
    if (!r.kommun) continue;
    (map[r.kommun] ??= []).push(r.stadsdel);
  }
  for (const k of Object.keys(map)) map[k] = [...new Set(map[k])].filter(Boolean).sort((a, b) => a.localeCompare(b, "sv"));
  return Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b, "sv")));
}

import type { Watch } from "@/generated/prisma/client";
import type { Filters } from "@/lib/filters";

/** Konverterar en sparad bevakning till samma form som filterfälten använder. */
export function watchToFilters(w: Watch): Filters {
  return {
    kommuner: w.kommuner,
    stadsdelar: w.stadsdelar,
    adress: w.adress ?? undefined,
    minRum: w.minRum ?? undefined,
    maxRum: w.maxRum ?? undefined,
    minYta: w.minYta ?? undefined,
    maxYta: w.maxYta ?? undefined,
    minHyra: w.minHyra ?? undefined,
    maxHyra: w.maxHyra ?? undefined,
    minVaning: w.minVaning ?? undefined,
    maxVaning: w.maxVaning ?? undefined,
    balkong: w.balkong ?? undefined,
    hiss: w.hiss ?? undefined,
    nyproduktion: w.nyproduktion ?? undefined,
    inkluderaUngdom: w.inkluderaUngdom || undefined,
    inkluderaStudent: w.inkluderaStudent || undefined,
    inkluderaSenior: w.inkluderaSenior || undefined,
    inkluderaKorttid: w.inkluderaKorttid || undefined,
    nya: undefined,
  };
}

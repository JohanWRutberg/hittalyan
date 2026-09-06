import type { Market } from "@/lib/markets";
import type { Source } from "@/lib/sources/types";
import { stockholmSource } from "@/lib/sources/stockholm";
import { boplatsVastSource } from "@/lib/sources/boplats-vast";
import { momentumSource } from "@/lib/sources/momentum";

/** Datakällan för varje förmedling. */
export const SOURCES: Record<Market, Source> = {
  stockholm: stockholmSource,
  vast: boplatsVastSource,
  syd: momentumSource("syd"),
  uppsala: momentumSource("uppsala"),
};

export type { Source, SourceListing, SourceResult, KnownListing } from "@/lib/sources/types";

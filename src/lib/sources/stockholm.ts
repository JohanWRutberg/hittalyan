/**
 * Bostadsförmedlingen i Stockholm. Endpointen är samma JSON som deras egen
 * söksida hämtar: ett anrop ger alla aktuella annonser, med kötidsstatistik.
 */

import { listingId } from "@/lib/markets";
import type { Source, SourceListing, SourceResult } from "@/lib/sources/types";
import { USER_AGENT } from "@/lib/sources/types";

export const BOSTAD_BASE_URL = "https://bostad.stockholm.se";
const LIST_URL = `${BOSTAD_BASE_URL}/AllaAnnonser/`;

export interface RawAnnons {
  LägenhetId: number;
  AnnonsId: number;
  ProjektId: number;
  Stadsdel: string;
  Gatuadress: string;
  Kommun: string;
  Vaning: number | null;
  AntalRum: number | null;
  Yta: number | null;
  Hyra: number | null;
  AnnonseradTill: string | null;
  AnnonseradFran: string | null;
  KoordinatLongitud: number | null;
  KoordinatLatitud: number | null;
  Url: string;
  Balkong: boolean;
  Hiss: boolean;
  Nyproduktion: boolean;
  Ungdom: boolean;
  Student: boolean;
  Senior: boolean;
  Korttid: boolean;
  Vanlig: boolean;
  Bostadssnabben: boolean;
  KoNamn: string | null;
  Lagenhetstyp: string | null;
  LiknadeLagenhetStatistik?: {
    KotidFordelningQ1: number | null;
    KotidFordelningQ3: number | null;
  } | null;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalize(raw: RawAnnons): SourceListing {
  return {
    id: listingId("stockholm", raw.AnnonsId),
    market: "stockholm",
    externalId: String(raw.AnnonsId),
    apartmentId: raw.LägenhetId ?? null,
    projectId: raw.ProjektId || null,
    kommun: (raw.Kommun ?? "").trim(),
    stadsdel: (raw.Stadsdel ?? "").trim(),
    gatuadress: (raw.Gatuadress ?? "").replace(/\s+/g, " ").trim(),
    vaning: raw.Vaning ?? null,
    antalRum: raw.AntalRum ?? null,
    yta: raw.Yta ?? null,
    hyra: raw.Hyra ?? null,
    annonseradFran: parseDate(raw.AnnonseradFran),
    annonseradTill: parseDate(raw.AnnonseradTill),
    lat: raw.KoordinatLatitud ?? null,
    lng: raw.KoordinatLongitud ?? null,
    url: raw.Url?.startsWith("http") ? raw.Url : `${BOSTAD_BASE_URL}${raw.Url ?? ""}`,
    balkong: !!raw.Balkong,
    hiss: !!raw.Hiss,
    nyproduktion: !!raw.Nyproduktion,
    ungdom: !!raw.Ungdom,
    student: !!raw.Student,
    senior: !!raw.Senior,
    korttid: !!raw.Korttid,
    vanlig: !!raw.Vanlig,
    bostadssnabben: !!raw.Bostadssnabben,
    koNamn: raw.KoNamn ?? null,
    hyresvard: null,
    lagenhetstyp: raw.Lagenhetstyp ?? null,
    kotidQ1: raw.LiknadeLagenhetStatistik?.KotidFordelningQ1 ?? null,
    kotidQ3: raw.LiknadeLagenhetStatistik?.KotidFordelningQ3 ?? null,
    kotidSnitt: null,
    sokande: null, // finns inte i flödet från Stockholm
  };
}

export async function fetchAllListings(): Promise<SourceListing[]> {
  const res = await fetch(LIST_URL, {
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${BOSTAD_BASE_URL}/bostad`,
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`Bostadsförmedlingen svarade ${res.status}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("Oväntat svar från Bostadsförmedlingen (ingen lista)");
  }
  return (data as RawAnnons[]).filter((a) => typeof a?.AnnonsId === "number").map(normalize);
}

/** Ett anrop ger allt, så varje körning hämtar om alla annonser. */
export const stockholmSource: Source = {
  market: "stockholm",
  async fetchListings(): Promise<SourceResult> {
    const listings = await fetchAllListings();
    return { activeIds: listings.map((l) => l.id), listings };
  },
};

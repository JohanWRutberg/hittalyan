/**
 * Hämtar alla aktuella annonser från Bostadsförmedlingen i Stockholm.
 * Endpointen är samma JSON som deras egen söksida använder.
 */

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

export interface NormalizedListing {
  id: number;
  apartmentId: number;
  projectId: number | null;
  kommun: string;
  stadsdel: string;
  gatuadress: string;
  vaning: number | null;
  antalRum: number | null;
  yta: number | null;
  hyra: number | null;
  annonseradFran: Date | null;
  annonseradTill: Date | null;
  lat: number | null;
  lng: number | null;
  url: string;
  balkong: boolean;
  hiss: boolean;
  nyproduktion: boolean;
  ungdom: boolean;
  student: boolean;
  senior: boolean;
  korttid: boolean;
  vanlig: boolean;
  bostadssnabben: boolean;
  koNamn: string | null;
  lagenhetstyp: string | null;
  kotidQ1: number | null;
  kotidQ3: number | null;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalize(raw: RawAnnons): NormalizedListing {
  return {
    id: raw.AnnonsId,
    apartmentId: raw.LägenhetId,
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
    lagenhetstyp: raw.Lagenhetstyp ?? null,
    kotidQ1: raw.LiknadeLagenhetStatistik?.KotidFordelningQ1 ?? null,
    kotidQ3: raw.LiknadeLagenhetStatistik?.KotidFordelningQ3 ?? null,
  };
}

export async function fetchAllListings(): Promise<NormalizedListing[]> {
  const res = await fetch(LIST_URL, {
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${BOSTAD_BASE_URL}/bostad`,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36",
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

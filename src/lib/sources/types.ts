import type { Market } from "@/lib/markets";

/** En annons i vår egen form, oavsett vilken förmedling den kommer från. */
export interface SourceListing {
  /** "<marknad>:<externalId>" */
  id: string;
  market: Market;
  /** Annonsens id hos förmedlingen, som text eftersom formaten skiljer sig åt */
  externalId: string;
  apartmentId: number | null;
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
  hyresvard: string | null;
  lagenhetstyp: string | null;
  /** Kötidens kvartiler för liknande lägenheter, i år (Stockholm) */
  kotidQ1: number | null;
  kotidQ3: number | null;
  /** Genomsnittlig kötid i området senaste 12 månaderna, i år (Boplats Väst) */
  kotidSnitt: number | null;
  /** Antal sökande just nu */
  sokande: number | null;
}

export interface SourceResult {
  /** Alla annonser som är aktiva hos förmedlingen just nu. Används för att
   *  avaktivera dem som försvunnit, även de vi inte hämtat om. */
  activeIds: string[];
  /** Annonser med fullständiga uppgifter: alltid de nya, plus de kända som
   *  källan valt att fräscha upp den här körningen. */
  listings: SourceListing[];
}

/** Det vi redan vet om en annons, för källor som vill undvika onödiga anrop. */
export interface KnownListing {
  /** När annonsen senast hämtades i sin helhet */
  refreshedAt: Date;
  /** Redan hämtad kötidsstatistik, som ändras för långsamt för att hämtas om */
  kotidSnitt: number | null;
}

export interface Source {
  market: Market;
  /**
   * Hämtar aktuella annonser. `known` är annonser vi redan har. Källor som
   * behöver ett extra anrop per annons använder den för att bara hämta nya och
   * ett fåtal äldre per körning.
   */
  fetchListings(known: ReadonlyMap<string, KnownListing>): Promise<SourceResult>;
}

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36";

/**
 * Klockslag spelar ingen roll för "sista dag att söka", men tidszonen gör det:
 * en tidpunkt strax före midnatt kan renderas som nästa dag i webbläsaren.
 * Därför läggs datum utan tidszonsuppgift mitt på dagen i UTC.
 */
export function middayUtc(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return Number.isNaN(d.getTime()) ? null : d;
}

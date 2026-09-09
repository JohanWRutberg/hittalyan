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
  /**
   * Bild-URL:er hos förmedlingen, i visningsordning.
   * `undefined` betyder "inte hämtat den här körningen" och lämnar det som redan
   * finns sparat i fred; en tom lista betyder "hämtat, men annonsen saknar bilder".
   */
  images?: string[];
  /**
   * Kötiderna för dem som sökt annonsen, tidigast registreringsdatum först.
   * `undefined` betyder "inte hämtat den här körningen" och rör inte det sparade.
   */
  queueDates?: Date[];
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
  /** Har vi redan bilder? Källor som behöver ett extra anrop hämtar bara dem som saknar. */
  hasImages: boolean;
  /**
   * När vi senast försökte hämta bilder, eller null om vi aldrig gjort det.
   * Skiljer "annonsen har inga bilder" från "inte försökt än", så att bildlösa
   * annonser inte hämtas om varje körning.
   */
  imagesCheckedAt: Date | null;
  /** När kötiderna för sökande senast hämtades, eller null om aldrig. */
  queueDatesAt: Date | null;
}

export interface Source {
  market: Market;
  /**
   * Behöver källan extraanrop per annons (och därmed en del av tidsbudgeten)?
   * Källor som får allt i ett svar sätter inte den här och lämnar budgeten
   * till dem som faktiskt behöver den.
   */
  usesFetchBudget?: boolean;
  /**
   * Hämtar aktuella annonser. `known` är annonser vi redan har; källor som
   * behöver ett extra anrop per annons använder den för att bara hämta det som
   * saknas. `deadline` (epoch-ms) är hur länge källan får hålla på med sådana
   * extraanrop innan resten ska lämnas till nästa körning – hela pollningen
   * delar på Vercels tidsgräns.
   */
  fetchListings(known: ReadonlyMap<string, KnownListing>, deadline: number): Promise<SourceResult>;
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

/** HTTP-fel från en förmedling, med statuskoden kvar så att den går att bedöma. */
export class SourceHttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "SourceHttpError";
  }
}

/**
 * Går felet över av sig självt? Nätverksfel och avbrutna anrop gör det, liksom
 * 5xx, 429 och 408. Ett 404 eller 403 gör det inte: då är det vi som gör fel,
 * och att fråga om tre gånger hjälper ingen.
 */
function transient(err: unknown): boolean {
  if (err instanceof SourceHttpError) return err.status >= 500 || err.status === 429 || err.status === 408;
  return true;
}

/** Hur länge återförsök på listhämtningen får hålla på, om inget annat sägs. */
export const RETRY_WINDOW_MS = 20_000;

/**
 * Försöker om vid tillfälliga fel.
 *
 * Förmedlingarnas servrar är inga API:er utan vanliga webbplatser, och de
 * svarar då och då 5xx eller bryter anslutningen mitt i. Tidigare fällde ett
 * enda sådant svar på **listhämtningen** hela körningen för förmedlingen, och
 * eftersom cron-jobbet kör en förmedling per anrop blev det ett rött
 * Actions-jobb – trots att nästa försök tio sekunder senare hade gått bra.
 *
 * Bara listhämtningen försöks om. Extraanropen per annons är redan valfria,
 * delar på tidsbudgeten och tas nästa körning om de missar.
 */
export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  opts: { attempts?: number; until?: number } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const until = opts.until ?? Date.now() + RETRY_WINDOW_MS;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!transient(err) || i === attempts - 1) break;
      // Kort paus med slump, så att flera körningar inte träffar samtidigt.
      const wait = 600 * 2 ** i + Math.random() * 400;
      if (Date.now() + wait >= until) break;
      console.warn(`[poll:${label}] försök ${i + 1}/${attempts} misslyckades:`, (err as Error).message);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last;
}

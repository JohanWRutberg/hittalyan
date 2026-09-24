/**
 * HomeQ är ingen bostadsförmedling utan en marknadsplats: drygt tvåtusen privata
 * hyresvärdar annonserar där, var och en med sin egen kö. Därför finns ingen
 * gemensam kötid, ingen kötidsstatistik och ingen sista dag att söka – annonsen
 * ligger uppe tills den är uthyrd. Det är också den enda av våra källor som är
 * rikstäckande: annonserna ligger i drygt tvåhundra kommuner.
 *
 * - **`POST /api/v3/search` med `{"amount": 10000}`** – alla annonser med adress,
 *   kommun, ort, koordinat, hyra, rum, yta, bilder, tillträde och målgrupp. ~8 MB
 *   på ~3 sekunder, och därmed hela utbudet i **ett** anrop. Se `PAGE_SIZE`.
 * - **`GET /api/v1/landlords/list`** – hyresvärdarnas namn, som annonserna bara
 *   refererar till med ett id.
 *
 * **Objektfrågan `/api/v1/object/<id>` används med flit inte.** Den skulle ge
 * våning, balkong, hiss och nyproduktion, men bara med ett anrop per annons – och
 * HomeQ rate-limitar den. Ett försök att hämta några hundra annonser i rad
 * svarade 429 på var och en. Med drygt sextusen annonser skulle en sådan
 * uppbyggnad ta dygn och samtidigt hamra på någon annans API. Därför saknar
 * HomeQ våning och utrustning hos oss, och `hasFloor`/`hasAmenities` i
 * `markets.ts` står på false så att gränssnittet inte lovar det vi inte har.
 *
 * Projektannonser sorteras bort: de beskriver ett helt nybygge och inte en
 * bestämd lägenhet, och saknar därför både hyra, rum och yta.
 */

import { listingId } from "@/lib/markets";
import type { KnownListing, Source, SourceListing, SourceResult } from "@/lib/sources/types";
import { SourceHttpError, USER_AGENT, withRetry } from "@/lib/sources/types";

const API = "https://api.homeq.se";
const SITE = "https://www.homeq.se";

const headers = {
  "Content-Type": "application/json",
  Accept: "application/json",
  Origin: SITE,
  Referer: `${SITE}/`,
  "User-Agent": USER_AGENT,
};

interface RawResult {
  id: number;
  /** "individual" eller "project" */
  type: string;
  /** Sökvägen till annonsen, utan domän */
  uri: string | null;
  /** Gatuadressen */
  title: string | null;
  municipality: string | null;
  city: string | null;
  location: { lat: number | null; lon: number | null } | null;
  rent: number | null;
  rooms: number | null;
  area: number | null;
  /** Tillträdesdag – inte sista ansökningsdag, som HomeQ inte har */
  date_access: string | null;
  is_short_lease: boolean | null;
  /** "everyone" | "student" | "senior" | "youth", ibland som lista */
  audience: string | string[] | null;
  references: { company: number | null } | null;
  images: { image: string | null; position: number | null }[] | null;
}

const audienceOf = (a: string | string[] | null): string[] =>
  a == null ? [] : Array.isArray(a) ? a : [a];

function stadsdelOf(raw: RawResult): string {
  const city = (raw.city ?? "").trim();
  const kommun = (raw.municipality ?? "").trim();
  return city && city.toLowerCase() === kommun.toLowerCase() ? "" : city;
}

/**
 * Hur många träffar sökningen ska lämna ut. **10 000 är HomeQ:s tak**: 10 001 ger
 * ett tomt svar. Det räcker med god marginal – utbudet ligger runt 6 500.
 *
 * I september 2026 slutade en tom kropp ge hela utbudet och började ge de första
 * **tio**, utan förvarning. Eftersom tio inte är noll gick det förbi spärren mot
 * tomma svar i pollningen, och varje körning avaktiverade allt utom tio annonser.
 * `offset` i kroppen ignoreras, så det finns ingen sidbläddring att falla tillbaka
 * på – det är ett anrop eller inget.
 */
const PAGE_SIZE = 10_000;

async function fetchAll(): Promise<RawResult[]> {
  const res = await fetch(`${API}/api/v3/search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ amount: PAGE_SIZE }),
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new SourceHttpError(`HomeQ svarade ${res.status}`, res.status);
  const body = (await res.json()) as { results?: RawResult[]; total_hits?: number };
  if (!Array.isArray(body?.results)) throw new Error("Oväntat svar från HomeQ (inga träffar)");
  // Spärren som saknades: färre träffar än HomeQ själv säger att det finns betyder
  // ett stympat svar, inte att annonserna försvunnit. Ett stympat svar får aldrig
  // nå pollningen – då avaktiveras allt som inte kom med. Hellre en misslyckad
  // körning som syns i adminportalen än tusentals annonser som tyst försvinner.
  // Växer utbudet förbi PAGE_SIZE blir det också ett högljutt fel, inte ett tyst.
  if (typeof body.total_hits === "number" && body.results.length < body.total_hits) {
    throw new Error(`HomeQ gav ${body.results.length} av ${body.total_hits} träffar – svaret är stympat`);
  }
  return body.results.filter((r) => typeof r?.id === "number" && r.type === "individual");
}

/**
 * Hyresvärdarnas namn. Annonserna bär bara ett id, och listan är liten nog att
 * hämta varje körning. Går den inte att hämta får annonserna stå utan namn –
 * det är inte värt att fälla en hel körning för.
 */
async function fetchLandlords(): Promise<Map<number, string>> {
  try {
    const res = await fetch(`${API}/api/v1/landlords/list`, { headers, cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return new Map();
    const body = (await res.json()) as { available_landlords?: { label: string | null; value: number | null }[] };
    const map = new Map<number, string>();
    for (const l of body?.available_landlords ?? []) {
      if (typeof l?.value === "number" && l.label) map.set(l.value, l.label.trim());
    }
    return map;
  } catch {
    return new Map();
  }
}

function normalize(raw: RawResult, landlords: Map<number, string>): SourceListing {
  const audience = audienceOf(raw.audience);
  const student = audience.includes("student");
  const senior = audience.includes("senior");
  const youth = audience.includes("youth");
  const korttid = !!raw.is_short_lease;
  const company = raw.references?.company ?? null;

  return {
    id: listingId("homeq", raw.id),
    market: "homeq",
    externalId: String(raw.id),
    apartmentId: null,
    projectId: null,
    kommun: (raw.municipality ?? "").trim(),
    // HomeQ:s "city" är orten inom kommunen – Hulu i Ulricehamn, Bergsjön i
    // Göteborg – alltså samma roll som stadsdel hos de andra källorna. I de stora
    // städerna är den däremot bara kommunens eget namn, och "Göteborg, Göteborg"
    // är ingen upplysning. Då lämnas stadsdelen tom, precis som hos Momentum.
    stadsdel: stadsdelOf(raw),
    gatuadress: (raw.title ?? "").replace(/\s+/g, " ").trim(),
    // Lämnas inte ut i sökningen, och objektfrågan är rate-limitad. Se filhuvudet.
    vaning: null,
    antalRum: raw.rooms ?? null,
    yta: raw.area == null ? null : Math.round(raw.area),
    hyra: raw.rent ?? null,
    // HomeQ anger tillträdesdag, inte när annonsen publicerades. Att lägga
    // tillträdet i annonseradFran vore fel: det är då man flyttar in, inte då
    // annonsen kom. När vi först såg den står i firstSeenAt ändå.
    annonseradFran: null,
    // Ingen sista dag: annonsen ligger uppe tills den är uthyrd. Se `hasDeadline`.
    annonseradTill: null,
    lat: raw.location?.lat ?? null,
    lng: raw.location?.lon ?? null,
    url: raw.uri ? `${SITE}${raw.uri}` : `${SITE}/lagenhet/${raw.id}`,
    balkong: false,
    hiss: false,
    nyproduktion: false,
    ungdom: youth,
    student,
    senior,
    korttid,
    vanlig: !youth && !student && !senior && !korttid,
    bostadssnabben: false,
    koNamn: null,
    hyresvard: (company != null ? landlords.get(company) : null) ?? null,
    lagenhetstyp: null,
    kotidQ1: null,
    kotidQ3: null,
    kotidSnitt: null,
    sokande: null,
    images: [...(raw.images ?? [])]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((i) => i.image)
      .filter((u): u is string => !!u),
  };
}

/**
 * Ett anrop ger allt, så varje körning hämtar om alla annonser. Källan tar därför
 * ingen del av tidsbudgeten för extraanrop – den lämnas till Stockholm och Väst,
 * som behöver ett anrop per annons.
 *
 * **Bilderna skickas bara vidare för annonser vi inte redan har bilder på.**
 * Sökningen ger dem för alla varje gång, men för en annons som redan har bilder
 * sparade blir `images` `undefined` – samma kontrakt som Stockholm använder, och
 * det betyder "inte hämtat den här körningen". Annars jämförde pollningen
 * drygt sextusen bildlistor varje halvtimme, och att läsa de gamla ur databasen
 * för jämförelsen var den enskilt största posten i Neons datatrafik (~3 MB per
 * körning). Adresserna är S3-nycklar som inte ändras för en annons, så jämförelsen
 * gav ändå aldrig något. Annonser utan bilder får fortsatt listan varje gång, så
 * att bilder som läggs till i efterhand kommer med.
 */
export const homeqSource: Source = {
  market: "homeq",
  async fetchListings(known: ReadonlyMap<string, KnownListing>): Promise<SourceResult> {
    const [raw, landlords] = await Promise.all([withRetry("homeq", fetchAll), fetchLandlords()]);
    const listings = raw.map((r) => {
      const l = normalize(r, landlords);
      return known.get(l.id)?.hasImages ? { ...l, images: undefined } : l;
    });
    return { activeIds: listings.map((l) => l.id), listings };
  },
};

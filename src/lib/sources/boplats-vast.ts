/**
 * Boplats Väst har inget JSON-flöde. Söksidan är serverrenderad och ger alla
 * aktuella annonser på en sida (ingen sidbläddring), men bara id, område, hyra,
 * yta, rum och våning. Våningsplan, balkong, hiss, koordinater, hyresvärd och
 * sista ansökningsdag finns bara på objektsidan, och kötidsstatistiken hämtas
 * från en egen endpoint per annons.
 *
 * Nya annonser går alltid först och får hela sin tidsbudget (`FRESH_TIME_BUDGET_MS`):
 * användarna ska se en ny annons så fort som möjligt, inte vänta flera pollningar på
 * att en fast per-körning-gräns ska hinna beta av en ovanligt stor klump. Ett fast
 * antal per körning gav precis det problemet vid en kall start: med tidigare
 * MAX_NEW_PER_RUN=30 mot ~111 annonser tog det fyra körningar (två timmar) innan
 * hela utbudet syntes, trots att inget var fel – annonserna fanns bara inte hämtade
 * än. En tidsbudget anpassar sig i stället efter hur många som faktiskt är nya, och
 * hur snabbt boplats.se svarar just nu, utan att riskera Vercels 60-sekundersgräns
 * för hela pollningen (som delas med de tre andra förmedlingarna).
 *
 * Redan kända annonser fräschas upp (antal sökande m.m.) bara med den tid som blir
 * över, och högst ett bundet antal – det är en bonus, inte något användarna väntar på.
 */

import { listingId, marketInfo } from "@/lib/markets";
import type { KnownListing, Source, SourceListing, SourceResult } from "@/lib/sources/types";
import { USER_AGENT } from "@/lib/sources/types";

const BASE = marketInfo("vast").siteUrl;
const LIST_URL = `${BASE}/sok?types=1hand`;
const objectUrl = (id: string) => `${BASE}/objekt/1hand/${id}`;
const statsUrl = (id: string) => `${BASE}/area_statistics/1hand/${id}`;

/**
 * Så länge får nya annonser hämtas innan resten får vänta till nästa körning.
 * Uppmätt svarstid mot boplats.se är ~0.2–0.3 s per anrop; med marginal för
 * långsammare nätverk från Vercel räcker det här till några hundra annonser.
 */
const FRESH_TIME_BUDGET_MS = 40_000;
/** Tak på hur många kända annonser som fräschas upp, om tid blir över. */
const REFRESH_CEILING = 40;
/** Samtidiga hämtningar mot boplats.se. */
const CONCURRENCY = 4;

const MONTHS = [
  "januari", "februari", "mars", "april", "maj", "juni",
  "juli", "augusti", "september", "oktober", "november", "december",
];

async function getText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`Boplats Väst svarade ${res.status} på ${url}`);
  return res.text();
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const first = (html: string, re: RegExp): string | null => {
  const m = re.exec(html);
  return m ? decode(m[1]) : null;
};

const toNumber = (s: string | null): number | null => {
  if (!s) return null;
  const n = Number(s.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/**
 * "10 september" saknar årtal. Vi väljer det årtal som lägger datumet närmast
 * framåt i tiden, eftersom sista ansökningsdag alltid ligger nära nu.
 */
export function parseSwedishDay(text: string | null, now = new Date()): Date | null {
  if (!text) return null;
  const m = /(\d{1,2})\s+([a-zà-ö]+)/i.exec(text.toLowerCase());
  if (!m) return null;
  const month = MONTHS.findIndex((name) => name.startsWith(m[2].slice(0, 3)));
  if (month < 0) return null;
  const day = Number(m[1]);
  const year = now.getUTCFullYear();
  const candidates = [year - 1, year, year + 1].map((y) => Date.UTC(y, month, day, 12));
  // Närmast nu, med marginal bakåt: annonser kan ha passerat sista dagen nyss.
  const cutoff = now.getTime() - 45 * 86_400_000;
  const pick = candidates.filter((t) => t >= cutoff).sort((a, b) => a - b)[0] ?? candidates[1];
  return new Date(pick);
}

/** Alla id på söksidan, i den ordning de visas. */
export function parseListIds(html: string): string[] {
  const ids: string[] = [];
  const re = /id="search-listing-([A-Za-z0-9]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) ids.push(m[1]);
  return [...new Set(ids)];
}

/** Egenskaper ur blocken "Lägenheten har" och "Viktigt om lägenheten". */
function parseProperties(html: string): Set<string> {
  const props = new Set<string>();
  const re = /<div class="property">([\s\S]*?)<\/div>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) props.add(decode(m[1]).toLowerCase());
  return props;
}

export function parseObjectPage(id: string, html: string, now = new Date()): SourceListing | null {
  const gatuadress = first(html, /<h2 class="detail-street-address">([\s\S]*?)<\/h2>/);
  if (!gatuadress) return null;

  // "Hovås, Askim-Frölunda-Högsbo, Göteborg" – stadsdel först, kommun sist.
  const areaLine = first(html, /<p class="detail-area-desc">([\s\S]*?)<\/p>/) ?? "";
  const parts = areaLine.split(",").map((p) => p.trim()).filter(Boolean);
  const kommun = parts.length ? parts[parts.length - 1] : "";
  const stadsdel = parts.length > 1 ? parts[0] : "";

  const rumYta = /Antal rum:<\/span>\s*<span><strong>([\s\S]*?)<\/strong>\s*fördelat på\s*([\d\s,.]+)\s*m²/.exec(html);
  const props = parseProperties(html);
  const landlord = first(html, /Hyresvärd<\/h3>[\s\S]{0,400}?<li>([\s\S]*?)<\/li>/);

  return {
    id: listingId("vast", id),
    market: "vast",
    externalId: id,
    apartmentId: null,
    projectId: null,
    kommun,
    stadsdel,
    gatuadress,
    vaning: toNumber(first(html, /Våning:<\/span>\s*<span><strong>([\s\S]*?)<\/strong>/)),
    antalRum: rumYta ? toNumber(decode(rumYta[1])) : null,
    yta: rumYta ? Math.round(toNumber(decode(rumYta[2])) ?? 0) || null : null,
    hyra: toNumber(first(html, /Hyra:<\/span>\s*<span><strong>([\s\S]*?)kr\/mån<\/strong>/)),
    annonseradFran: null, // söksidan anger bara "Publ. idag" / "Publ. i går"
    annonseradTill: parseSwedishDay(first(html, /Anmäl senast:<\/span>\s*<span><strong>([\s\S]*?)<\/strong>/), now),
    lat: toNumber(first(html, /data-latitude="([\d.-]+)"/)),
    lng: toNumber(first(html, /data-longitude="([\d.-]+)"/)),
    url: objectUrl(id),
    balkong: props.has("balkong"),
    hiss: props.has("hiss"),
    nyproduktion: props.has("nyproduktion"),
    // Boplats Väst märker inte ut ungdoms-, student- eller seniorköer i annonsen.
    ungdom: false,
    student: false,
    senior: false,
    korttid: false,
    vanlig: true,
    bostadssnabben: false,
    koNamn: null,
    hyresvard: landlord,
    lagenhetstyp: null,
    kotidQ1: null,
    kotidQ3: null,
    kotidSnitt: null,
    sokande: toNumber(first(html, /data-show-id="queue-list">\s*([\d\s]+)\s*sökande/)),
  };
}

interface AreaStatistics {
  successData?: { averageQueueDays?: number | null; areaName?: string | null; noOfObjects?: number | null } | null;
}

/** Genomsnittlig kötid i området senaste 12 månaderna, i år. */
async function fetchAverageQueueYears(id: string): Promise<number | null> {
  try {
    const res = await fetch(statsUrl(id), {
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest", "User-Agent": USER_AGENT },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as AreaStatistics;
    const days = body?.successData?.averageQueueDays;
    return typeof days === "number" && days > 0 ? days / 365.25 : null;
  } catch {
    // Statistiken är en bonus; annonsen är användbar även utan den.
    return null;
  }
}

/**
 * Kör uppgifter några i taget i stället för alla på en gång, och slutar starta
 * nya omgångar när tidsbudgeten är slut. Resten hämtas nästa körning i stället.
 */
async function inBatchesUntil<T, R>(items: T[], size: number, deadline: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length && Date.now() < deadline; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

/**
 * Hämtar en annons i sin helhet. Kötidsstatistiken hämtas bara när vi inte redan
 * har den: den gäller hela området och ändras för långsamt för att hämtas om.
 */
async function fetchOne(id: string, cachedQueueYears: number | null): Promise<SourceListing | null> {
  try {
    const listing = parseObjectPage(id, await getText(objectUrl(id)));
    if (!listing) return null;
    listing.kotidSnitt = cachedQueueYears ?? (await fetchAverageQueueYears(id));
    return listing;
  } catch (err) {
    console.error(`[poll:vast] kunde inte hämta ${id}:`, (err as Error).message);
    return null;
  }
}

export const boplatsVastSource: Source = {
  market: "vast",
  async fetchListings(known): Promise<SourceResult> {
    const ids = parseListIds(await getText(LIST_URL));
    if (!ids.length) throw new Error("Oväntat svar från Boplats Väst (inga annonser)");
    const activeIds = ids.map((id) => listingId("vast", id));

    const seen = (id: string): KnownListing | undefined => known.get(listingId("vast", id));
    const fresh = ids.filter((id) => !seen(id));
    // Äldst uppdaterade först, så alla annonser turas om att bli uppfräschade.
    const stale = ids
      .filter((id) => seen(id))
      .sort((a, b) => seen(a)!.refreshedAt.getTime() - seen(b)!.refreshedAt.getTime())
      .slice(0, REFRESH_CEILING);

    const deadline = Date.now() + FRESH_TIME_BUDGET_MS;
    // Nya annonser går först och får hela budgeten. Uppfräschning av kända
    // annonser sker bara med tiden som blir över.
    const listings = [
      ...(await inBatchesUntil(fresh, CONCURRENCY, deadline, (id) => fetchOne(id, null))),
      ...(await inBatchesUntil(stale, CONCURRENCY, deadline, (id) => fetchOne(id, seen(id)?.kotidSnitt ?? null))),
    ];

    return { activeIds, listings: listings.filter((l): l is SourceListing => l != null) };
  },
};

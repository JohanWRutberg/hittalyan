/**
 * Bostadsförmedlingen i Stockholm. Endpointen är samma JSON som deras egen
 * söksida hämtar: ett anrop ger alla aktuella annonser, med kötidsstatistik.
 */

import { listingId } from "@/lib/markets";
import type { KnownListing, Source, SourceListing, SourceResult } from "@/lib/sources/types";
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

/**
 * Bilderna är det enda som inte finns i JSON-flödet. De ligger i ett
 * `<div class="image-slider">` på annonsens egen sida, som därför hämtas en gång
 * per annons. Tidsbudgeten (satt av pollningen) gör att en kall start (~700
 * annonser) sprids över några körningar i stället för att spränga Vercels
 * tidsgräns; i normal drift handlar det om ett par annonser per körning.
 */
const IMAGE_CONCURRENCY = 4;

export function parseImages(html: string): string[] {
  // Innehållet är bara <picture>-element, inga nästlade <div>, så första
  // avslutande taggen är rätt gräns.
  const slider = /<div class="image-slider[^"]*">([\s\S]*?)<\/div>/.exec(html);
  if (!slider) return [];
  const urls = [...slider[1].matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  return [...new Set(urls)]
    .filter((u) => u.startsWith("/uploads/"))
    .map((u) => `${BOSTAD_BASE_URL}${u}`);
}

async function fetchImages(listing: SourceListing): Promise<void> {
  try {
    const res = await fetch(listing.url, {
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": USER_AGENT },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return;
    listing.images = parseImages(await res.text());
  } catch {
    // Bilder är en bonus; annonsen är fullt användbar utan dem och försöket
    // görs om nästa körning.
  }
}

/**
 * Alla annonser har inte bilder – en del publiceras helt utan. De får inte
 * hämtas om varje körning, men en förmedling kan lägga till bilder i efterhand,
 * så bildlösa annonser prövas igen en gång per dygn.
 */
const RECHECK_AFTER_MS = 24 * 60 * 60 * 1000;

function needsImageFetch(known: KnownListing | undefined): boolean {
  if (!known) return true; // ny annons
  if (known.hasImages) return false;
  if (!known.imagesCheckedAt) return true; // aldrig försökt
  return Date.now() - known.imagesCheckedAt.getTime() > RECHECK_AFTER_MS;
}

export const stockholmSource: Source = {
  market: "stockholm",
  usesFetchBudget: true,
  async fetchListings(known, deadline): Promise<SourceResult> {
    // Ett anrop ger alla annonsers uppgifter, så de hämtas om varje körning.
    const listings = await fetchAllListings();

    // Nyast först: de syns överst i listan och är de användarna faktiskt tittar på.
    const needImages = listings
      .filter((l) => needsImageFetch(known.get(l.id)))
      .sort((a, b) => (b.annonseradFran?.getTime() ?? 0) - (a.annonseradFran?.getTime() ?? 0));
    for (let i = 0; i < needImages.length && Date.now() < deadline; i += IMAGE_CONCURRENCY) {
      await Promise.all(needImages.slice(i, i + IMAGE_CONCURRENCY).map(fetchImages));
    }

    return { activeIds: listings.map((l) => l.id), listings };
  },
};

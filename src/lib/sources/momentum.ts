/**
 * Boplats Syd och Uppsala bostadsförmedling kör samma plattform (Momentum). Deras
 * "Mina sidor"-app hämtar alla lediga objekt med en enda GraphQL-fråga mot
 * /mypages/api, utan inloggning. Frågan måste vara **namngiven**: anonyma
 * operationer avvisas med "Introspection queries are not allowed".
 *
 * Plattformen lämnar inte ut våningsplan i listan (bara i objektfrågan, som kräver
 * ett anrop per annons), och har ingen kötidsstatistik. Det den har är antal
 * sökande, som är grunden för chansmätaren i de här städerna.
 */

import { listingId, marketInfo, type Market } from "@/lib/markets";
import type { Source, SourceListing, SourceResult } from "@/lib/sources/types";
import { USER_AGENT, middayUtc } from "@/lib/sources/types";

const QUERY = `query getRentalObjectsAvailable {
  getRentalObjectsAvailable {
    rentalObjects {
      rentalObjectId
      street
      imageCdn
      images { imageId sortingOrder }
      rooms
      area
      rent
      applicationCount
      startDate
      endDate
      landlord
      projectName
      latitude
      longitude
      regionName
      districtName
      balcony
      elevator
      region { regionId }
      boendeTyp { name }
      bostadsTyp { name }
      kontraktsTyp { name }
      formedlingsTyp { name }
      fastighetsStatus { name }
    }
  }
}`;

interface Named {
  name: string | null;
}

interface RawObject {
  rentalObjectId: number;
  street: string | null;
  rooms: number | null;
  area: number | null;
  rent: number | null;
  applicationCount: number | null;
  startDate: string | null;
  endDate: string | null;
  landlord: string | null;
  projectName: string | null;
  latitude: number | null;
  longitude: number | null;
  regionName: string | null;
  districtName: string | null;
  balcony: boolean | null;
  elevator: boolean | null;
  region: { regionId: number | null } | null;
  imageCdn: string | null;
  images: { imageId: number | null; sortingOrder: number | null }[] | null;
  boendeTyp: Named[] | null;
  bostadsTyp: Named[] | null;
  kontraktsTyp: Named[] | null;
  formedlingsTyp: Named[] | null;
  fastighetsStatus: Named[] | null;
}

const names = (list: Named[] | null | undefined) => (list ?? []).map((n) => (n.name ?? "").toLowerCase());
const has = (list: Named[] | null | undefined, ...needles: string[]) => {
  const n = names(list);
  return needles.some((needle) => n.includes(needle.toLowerCase()));
};

/**
 * Bilderna ligger på plattformens CDN. `?width=` är den enda storleksparameter
 * den lyssnar på. Korten är som bredast ~400 px, och 480 räcker även på skärmar
 * med hög upplösning: originalet är ~265 kB, 480 ger ~83 kB och 640 ~132 kB.
 */
const IMAGE_WIDTH = 480;

function imageUrls(raw: RawObject): string[] {
  const cdn = raw.imageCdn?.replace(/\/+$/, "");
  if (!cdn || !raw.images?.length) return [];
  return [...raw.images]
    .sort((a, b) => (a.sortingOrder ?? 0) - (b.sortingOrder ?? 0))
    .filter((i) => i.imageId != null)
    .map((i) => `${cdn}/mypages/image/${i.imageId}?width=${IMAGE_WIDTH}`);
}

function normalize(market: Market, raw: RawObject): SourceListing {
  const info = marketInfo(market);
  // Objektet visas i förmedlingens egen app; det finns ingen delbar adress per
  // annons, så vi länkar till söklistan med rätt region förvald.
  const regionId = raw.region?.regionId;
  const url = `${info.siteUrl}/mypages/app/${regionId ? `?region=${regionId}` : ""}`;

  return {
    id: listingId(market, raw.rentalObjectId),
    market,
    externalId: String(raw.rentalObjectId),
    apartmentId: null,
    projectId: null,
    kommun: (raw.regionName ?? "").trim(),
    stadsdel: (raw.districtName ?? "").trim(),
    gatuadress: (raw.street ?? "").replace(/\s+/g, " ").trim(),
    vaning: null, // lämnas inte ut i listan
    antalRum: raw.rooms ?? null,
    yta: raw.area == null ? null : Math.round(raw.area),
    hyra: raw.rent == null ? null : Math.round(raw.rent),
    annonseradFran: middayUtc(raw.startDate),
    annonseradTill: middayUtc(raw.endDate),
    lat: raw.latitude ?? null,
    lng: raw.longitude ?? null,
    url,
    balkong: !!raw.balcony,
    hiss: !!raw.elevator,
    nyproduktion: has(raw.fastighetsStatus, "Nyproduktion"),
    ungdom: has(raw.boendeTyp, "Ungdom"),
    student: has(raw.boendeTyp, "Studentboende"),
    senior: has(raw.boendeTyp, "Senior", "Trygghetsboende"),
    korttid: has(raw.kontraktsTyp, "Korttidskontrakt"),
    vanlig: has(raw.boendeTyp, "Vanligt boende"),
    // "Bostad Direkt" förmedlas utan kötid, precis som Bostadssnabben i Stockholm
    bostadssnabben: has(raw.formedlingsTyp, "Bostad Direkt"),
    koNamn: null,
    hyresvard: raw.landlord?.trim() || null,
    lagenhetstyp: raw.bostadsTyp?.[0]?.name ?? null,
    kotidQ1: null,
    kotidQ3: null,
    kotidSnitt: null,
    sokande: raw.applicationCount ?? null,
    images: imageUrls(raw),
  };
}

export async function fetchMomentumListings(market: Market): Promise<SourceListing[]> {
  const info = marketInfo(market);
  const res = await fetch(`${info.siteUrl}/mypages/api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: info.siteUrl,
      Referer: `${info.siteUrl}/mypages/app`,
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({ operationName: "getRentalObjectsAvailable", variables: {}, query: QUERY }),
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`${info.name} svarade ${res.status}`);
  const body = (await res.json()) as { data?: { getRentalObjectsAvailable?: { rentalObjects?: RawObject[] } }; errors?: unknown };
  const objects = body?.data?.getRentalObjectsAvailable?.rentalObjects;
  if (!Array.isArray(objects)) throw new Error(`Oväntat svar från ${info.name} (inga objekt)`);
  return objects.filter((o) => typeof o?.rentalObjectId === "number").map((o) => normalize(market, o));
}

/** En fråga ger allt, så varje körning hämtar om alla annonser. */
export function momentumSource(market: Market): Source {
  return {
    market,
    async fetchListings(): Promise<SourceResult> {
      const listings = await fetchMomentumListings(market);
      return { activeIds: listings.map((l) => l.id), listings };
    },
  };
}

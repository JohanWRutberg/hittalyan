import type { Listing, Watch } from "@/generated/prisma/client";

export type WatchCriteria = Pick<
  Watch,
  | "kommuner"
  | "stadsdelar"
  | "adress"
  | "minRum"
  | "maxRum"
  | "minYta"
  | "maxYta"
  | "minHyra"
  | "maxHyra"
  | "minVaning"
  | "maxVaning"
  | "balkong"
  | "hiss"
  | "nyproduktion"
  | "inkluderaUngdom"
  | "inkluderaStudent"
  | "inkluderaSenior"
  | "inkluderaKorttid"
>;

const norm = (s: string) => s.toLocaleLowerCase("sv-SE").replace(/\s+/g, " ").trim();

/** "Nya gatan, Nackabacken | Värmdövägen 169" -> ["nya gatan", "nackabacken", "värmdövägen 169"] */
export function splitAddressTerms(adress: string): string[] {
  return adress
    .split(/[,;|]/)
    .map(norm)
    .filter(Boolean);
}

/** Returnerar true om annonsen matchar bevakningens kriterier. */
export function listingMatches(listing: Listing, w: WatchCriteria): boolean {
  if (w.kommuner.length && !w.kommuner.map(norm).includes(norm(listing.kommun))) return false;
  if (w.stadsdelar.length && !w.stadsdelar.map(norm).includes(norm(listing.stadsdel))) return false;

  if (w.adress) {
    const hay = norm(`${listing.gatuadress} ${listing.stadsdel} ${listing.kommun}`);
    const needles = splitAddressTerms(w.adress);
    if (needles.length && !needles.some((n) => hay.includes(n))) return false;
  }

  if (w.minRum != null && (listing.antalRum == null || listing.antalRum < w.minRum)) return false;
  if (w.maxRum != null && (listing.antalRum == null || listing.antalRum > w.maxRum)) return false;
  if (w.minYta != null && (listing.yta == null || listing.yta < w.minYta)) return false;
  if (w.maxYta != null && (listing.yta == null || listing.yta > w.maxYta)) return false;
  if (w.minHyra != null && (listing.hyra == null || listing.hyra < w.minHyra)) return false;
  if (w.maxHyra != null && (listing.hyra == null || listing.hyra > w.maxHyra)) return false;
  if (w.minVaning != null && (listing.vaning == null || listing.vaning < w.minVaning)) return false;
  if (w.maxVaning != null && (listing.vaning == null || listing.vaning > w.maxVaning)) return false;

  if (w.balkong === true && !listing.balkong) return false;
  if (w.hiss === true && !listing.hiss) return false;
  if (w.nyproduktion === true && !listing.nyproduktion) return false;
  if (w.nyproduktion === false && listing.nyproduktion) return false;

  // Specialköer utesluts om de inte uttryckligen inkluderats
  if (listing.ungdom && !w.inkluderaUngdom) return false;
  if (listing.student && !w.inkluderaStudent) return false;
  if (listing.senior && !w.inkluderaSenior) return false;
  if (listing.korttid && !w.inkluderaKorttid) return false;

  return true;
}

/**
 * De bostadsförmedlingar Hitta Lyan bevakar. En användare tillhör alltid exakt en
 * av dem, och ser bara den kön i taget. Valet görs vid registrering och kan bytas
 * under Konto. Utloggade besökare får Stockholm som standard, med byte via cookie.
 *
 * Förmedlingarnas namn är egennamn och skrivs likadant på svenska och engelska,
 * därför står de här i koden och inte i ordlistan.
 */

export const MARKETS = ["stockholm", "vast", "syd", "uppsala"] as const;
export type Market = (typeof MARKETS)[number];

export const DEFAULT_MARKET: Market = "stockholm";
export const MARKET_COOKIE = "hl_market";

export const isMarket = (v: unknown): v is Market => typeof v === "string" && (MARKETS as readonly string[]).includes(v);
export const marketOf = (v: unknown): Market => (isMarket(v) ? v : DEFAULT_MARKET);

/**
 * Hur chansen bedöms. Underlaget skiljer sig åt mellan förmedlingarna:
 * - `quartiles`: kötidens kvartiler för liknande lägenheter (Stockholm)
 * - `average`: genomsnittlig kötid i området senaste 12 månaderna (Boplats Väst)
 * - `applicants`: ingen kötidsstatistik alls, bara antal sökande just nu (Syd, Uppsala)
 */
export type ChanceMode = "quartiles" | "average" | "applicants";

export interface MarketInfo {
  code: Market;
  /** Förmedlingens namn, egennamn på båda språken */
  name: string;
  /** Kortform för menyer och märken */
  short: string;
  /** Staden kön utgår från */
  city: string;
  /** Förmedlingens egen webbplats */
  siteUrl: string;
  chance: ChanceMode;
  /** Lämnar källan ut våningsplan? Momentum-plattformen gör det inte i listan. */
  hasFloor: boolean;
  /** Har annonserna specialköer (ungdom, student, senior, korttid)? */
  hasSpecialQueues: boolean;
  /**
   * Nyckel i ordlistan för förmedlingens snabbförmedling utan kötid, om den
   * finns. Stockholm kallar den Bostadssnabben, Momentum-plattformen Bostad
   * Direkt; samma fält i databasen, men de heter inte samma sak.
   */
  quickLetTagKey: "bostadssnabben" | "bostadDirekt" | null;
  /** Kartans utgångsläge när inga annonser har koordinater */
  center: { lat: number; lng: number };
}

export const MARKET_INFO: Record<Market, MarketInfo> = {
  stockholm: {
    code: "stockholm",
    name: "Bostadsförmedlingen i Stockholm",
    short: "Stockholm",
    city: "Stockholm",
    siteUrl: "https://bostad.stockholm.se",
    chance: "quartiles",
    hasFloor: true,
    hasSpecialQueues: true,
    quickLetTagKey: "bostadssnabben",
    center: { lat: 59.3293, lng: 18.0686 },
  },
  vast: {
    code: "vast",
    name: "Boplats Väst",
    short: "Göteborg",
    city: "Göteborg",
    siteUrl: "https://boplats.se",
    chance: "average",
    hasFloor: true,
    hasSpecialQueues: false,
    quickLetTagKey: null,
    center: { lat: 57.7089, lng: 11.9746 },
  },
  syd: {
    code: "syd",
    name: "Boplats Syd",
    short: "Malmö",
    city: "Malmö",
    siteUrl: "https://www.boplatssyd.se",
    chance: "applicants",
    hasFloor: false,
    hasSpecialQueues: true,
    quickLetTagKey: "bostadDirekt",
    center: { lat: 55.605, lng: 13.0038 },
  },
  uppsala: {
    code: "uppsala",
    name: "Uppsala bostadsförmedling",
    short: "Uppsala",
    city: "Uppsala",
    siteUrl: "https://www.bostad.uppsala.se",
    chance: "applicants",
    hasFloor: false,
    hasSpecialQueues: true,
    quickLetTagKey: "bostadDirekt",
    center: { lat: 59.8586, lng: 17.6389 },
  },
};

export const marketInfo = (m: Market): MarketInfo => MARKET_INFO[m];

/** Sammansatt id: annonser från olika förmedlingar delar tabell men inte id-serier. */
export const listingId = (market: Market, externalId: string | number) => `${market}:${externalId}`;

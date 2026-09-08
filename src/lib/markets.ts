/**
 * Köerna Hitta Lyan bevakar. En användare tillhör alltid exakt en av dem, och ser
 * bara den kön i taget. Valet görs vid registrering och kan bytas under Konto.
 * Utloggade besökare får Stockholm som standard, med byte via cookie.
 *
 * Namnen är egennamn och skrivs likadant på svenska och engelska, därför står de
 * här i koden och inte i ordlistan.
 *
 * Fyra av dem är bostadsförmedlingar med kö och kötid. HomeQ är något annat: en
 * marknadsplats där privata hyresvärdar annonserar, utan gemensam kö och utan
 * kötidsstatistik. Skillnaden syns i `chance`, `coverage` och `hasDeadline`, och
 * den ska synas – att låtsas att den inte finns vore att lova något vi inte har.
 */

export const MARKETS = ["stockholm", "vast", "syd", "uppsala", "homeq"] as const;
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
 * - `none`: varken kötid eller antal sökande (HomeQ). Ingen mätare visas, och det
 *   sägs rakt ut i stället för att visa en tom stapel.
 */
export type ChanceMode = "quartiles" | "average" | "applicants" | "none";

/**
 * Hur stort område kön förmedlar i. `region` har ett avgränsat område på kartan,
 * `national` täcker hela landet och tänder därför hela mosaiken.
 */
export type Coverage = "region" | "national";

export interface MarketInfo {
  code: Market;
  /** Förmedlingens namn, egennamn på båda språken */
  name: string;
  /**
   * Etiketten som visas för användaren: köns namn i dagligt tal. Två av dem
   * heter efter staden och två efter förmedlingen, och det är med flit – så
   * heter de på riktigt. Stockholm och Uppsala kallas aldrig något annat, medan
   * Boplats Väst och Boplats Syd förmedlar i hela regioner och inte bara i
   * Göteborg och Malmö. Att kalla dem "Göteborg" och "Malmö" var missvisande:
   * Boplats Syd förmedlar i 22 skånska kommuner, ända till Osby och Bromölla.
   *
   * Där etiketten och `name` visas tillsammans utelämnas `name` när de är lika,
   * annars hade "Boplats Väst" stått två gånger under varandra.
   */
  short: string;
  coverage: Coverage;
  /** Förmedlingens egen webbplats */
  siteUrl: string;
  chance: ChanceMode;
  /** Lämnar källan ut våningsplan? Momentum-plattformen gör det inte i listan. */
  hasFloor: boolean;
  /**
   * Lämnar källan ut balkong, hiss och nyproduktion? HomeQ har uppgifterna, men
   * bara bakom en objektfråga som är rate-limitad – se `sources/homeq.ts`. Utan
   * flaggan hade filtret visat kryssrutor som alltid ger noll träffar.
   */
  hasAmenities: boolean;
  /** Har annonserna specialköer (ungdom, student, senior, korttid)? */
  hasSpecialQueues: boolean;
  /**
   * Har annonserna en sista dag att söka? HomeQ:s annonser ligger uppe tills de
   * är uthyrda, så där finns inget datum att visa eller sortera på.
   */
  hasDeadline: boolean;
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
    siteUrl: "https://bostad.stockholm.se",
    chance: "quartiles",
    coverage: "region",
    hasFloor: true,
    hasAmenities: true,
    hasSpecialQueues: true,
    hasDeadline: true,
    quickLetTagKey: "bostadssnabben",
    center: { lat: 59.3293, lng: 18.0686 },
  },
  vast: {
    code: "vast",
    name: "Boplats Väst",
    short: "Boplats Väst",
    siteUrl: "https://boplats.se",
    chance: "average",
    coverage: "region",
    hasFloor: true,
    hasAmenities: true,
    hasSpecialQueues: false,
    hasDeadline: true,
    quickLetTagKey: null,
    center: { lat: 57.7089, lng: 11.9746 },
  },
  syd: {
    code: "syd",
    name: "Boplats Syd",
    short: "Boplats Syd",
    siteUrl: "https://www.boplatssyd.se",
    chance: "applicants",
    coverage: "region",
    hasFloor: false,
    hasAmenities: true,
    hasSpecialQueues: true,
    hasDeadline: true,
    quickLetTagKey: "bostadDirekt",
    center: { lat: 55.605, lng: 13.0038 },
  },
  uppsala: {
    code: "uppsala",
    name: "Uppsala bostadsförmedling",
    short: "Uppsala",
    siteUrl: "https://www.bostad.uppsala.se",
    chance: "applicants",
    coverage: "region",
    hasFloor: false,
    hasAmenities: true,
    hasSpecialQueues: true,
    hasDeadline: true,
    quickLetTagKey: "bostadDirekt",
    center: { lat: 59.8586, lng: 17.6389 },
  },
  homeq: {
    code: "homeq",
    name: "HomeQ",
    short: "HomeQ",
    siteUrl: "https://www.homeq.se",
    // Kötidsstatistiken finns hos HomeQ, men bara bakom inloggning. Vi visar
    // hellre ingen mätare än en gissning.
    chance: "none",
    coverage: "national",
    hasFloor: false,
    hasAmenities: false,
    hasSpecialQueues: true,
    hasDeadline: false,
    quickLetTagKey: null,
    // Mitt i landet: annonserna ligger i drygt 200 kommuner, så det finns ingen
    // stad att utgå från.
    center: { lat: 62.5, lng: 16.5 },
  },
};

export const marketInfo = (m: Market): MarketInfo => MARKET_INFO[m];

/** Sammansatt id: annonser från olika förmedlingar delar tabell men inte id-serier. */
export const listingId = (market: Market, externalId: string | number) => `${market}:${externalId}`;

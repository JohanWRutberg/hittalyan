import type { Market } from "@/lib/markets";

/**
 * Sverige som ett rutnät – underlaget till mosaikkartan på startsidan.
 *
 * Rutorna är framräknade ur landets kontur: en ruta finns där dess mittpunkt
 * ligger på land. Projektionen är equirectangular med longituden skalad med
 * cos(62°), så att rutorna blir ungefär kvadratiska i verkligheten i stället för
 * utdragna på bredden. Det är därför Sverige lutar åt vänster längst i norr,
 * precis som på en riktig karta.
 *
 * Rutnätet ligger som text och inte som koordinater, eftersom det är lättare att
 * se formen och rätta en enstaka ruta för hand. Bokstäverna märker ut vilken kö
 * som förmedlar bostäder i området:
 *
 *   `.` hav   `#` land utan kö hos oss   `S` Stockholm  `U` Uppsala
 *   `V` Boplats Väst   `Y` Boplats Syd
 *
 * En ruta hör till den kö vars centrum ligger närmast, mätt i **andel av köns
 * räckvidd**. Räckvidden speglar hur stort område förmedlingen faktiskt täcker,
 * och det är det som gör att Stockholms län får fler rutor än Uppsala trots att
 * centrumen ligger sex mil isär. Utan viktningen svalde Uppsala halva Mälardalen.
 *
 * En rikstäckande kö (som HomeQ, om den läggs till) hör inte hemma i rutnätet:
 * den skulle tända hela kartan och har därför ingen bokstav här.
 */
export const MOSAIC_ROWS = [
  "..........#....",
  "..........###..",
  "........######.",
  "......########.",
  "......########.",
  ".....#########.",
  ".....#########.",
  "....##########.",
  "....########...",
  "...#########...",
  "...#########...",
  "...########....",
  "..########.....",
  ".########......",
  ".#######.......",
  ".#######.......",
  ".######........",
  "..#####........",
  "..#####........",
  "..######.......",
  "..####UUS......",
  ".####SUUS......",
  ".####SSS.......",
  "#####SSS.......",
  "VVV###S........",
  ".VVV##.........",
  ".VVV##..#......",
  ".VV###..#......",
  "..#####........",
  "..YY##.........",
  "..YY...........",
  "..YY...........",
] as const;

export const MOSAIC_COLS = 15;
export const MOSAIC_ROW_COUNT = MOSAIC_ROWS.length;

const AREA_MARKET: Record<string, Market> = {
  S: "stockholm",
  U: "uppsala",
  V: "vast",
  Y: "syd",
};

export interface MosaicTile {
  row: number;
  col: number;
  /** Kön som förmedlar i rutan, eller null för land utan kö. */
  market: Market | null;
  /** 0–3. Styr hur genomskinlig rutan är, så att mosaiken får djup. */
  depth: number;
  /** 0–1. Var i andningscykeln rutan börjar, så att de inte pulserar i takt. */
  phase: number;
  /** 0–1. Hur fort rutan andas. Sprider takten så mönstret aldrig upprepar sig. */
  speed: number;
}

/**
 * Djup, fas och takt ska se slumpmässiga ut men vara **samma vid varje
 * rendering** – annars räknar servern och webbläsaren olika och mosaiken hoppar
 * till vid hydrering. En liten heltalshash av rutans läge räcker; en
 * slumpgenerator vore precis fel verktyg här.
 */
const hash = (row: number, col: number, salt: number) => Math.imul(row * 73 + col * 151 + salt, 2654435761) >>> 0;
const unit = (row: number, col: number, salt: number) => ((hash(row, col, salt) >>> 11) % 1000) / 1000;

export const MOSAIC_TILES: MosaicTile[] = MOSAIC_ROWS.flatMap((line, row) =>
  [...line].flatMap((ch, col) =>
    ch === "."
      ? []
      : [
          {
            row,
            col,
            market: AREA_MARKET[ch] ?? null,
            depth: (hash(row, col, 17) >>> 13) % 4,
            phase: unit(row, col, 101),
            speed: unit(row, col, 211),
          },
        ],
  ),
);

/** Köerna som faktiskt har ett område i rutnätet, i ordning uppifrån och ned. */
export const MOSAIC_MARKETS: Market[] = [...new Set(MOSAIC_TILES.map((t) => t.market).filter((m): m is Market => m !== null))];

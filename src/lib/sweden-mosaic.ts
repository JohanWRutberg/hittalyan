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
}

/**
 * Djupet ska se slumpmässigt ut men vara samma vid varje rendering – annars
 * flimrar mosaiken när servern och webbläsaren råkar räkna olika. En liten
 * heltalshash av rutans läge räcker och behöver ingen slumpgenerator.
 */
const depthOf = (row: number, col: number) => {
  const h = Math.imul(row * 73 + col * 151 + 17, 2654435761) >>> 0;
  return (h >>> 13) % 4;
};

export const MOSAIC_TILES: MosaicTile[] = MOSAIC_ROWS.flatMap((line, row) =>
  [...line].flatMap((ch, col) =>
    ch === "." ? [] : [{ row, col, market: AREA_MARKET[ch] ?? null, depth: depthOf(row, col) }],
  ),
);

/** Köerna som faktiskt har ett område i rutnätet, i ordning uppifrån och ned. */
export const MOSAIC_MARKETS: Market[] = [...new Set(MOSAIC_TILES.map((t) => t.market).filter((m): m is Market => m !== null))];

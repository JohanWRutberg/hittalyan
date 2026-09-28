/**
 * Likadana lägenheter slås ihop till ett kort.
 *
 * Förmedlingarna lägger ofta ut flera objekt som är identiska i allt vi kan visa:
 * olika id hos förmedlingen, men samma adress, storlek, hyra och sista dag.
 * Rackarbergsgatan 14 i Uppsala hade elva likadana studentrum. Momentum lämnar
 * inte ut våning eller lägenhetsnummer i listan, så korten gick inte att skilja åt
 * och såg ut som dubbletter – en testare frågade om det var ett fel.
 *
 * Nyckeln är allt som syns på kortet och skiljer två lägenheter åt. Våningen är
 * med, så att Stockholms lägenheter på olika plan aldrig slås ihop, och sista dag
 * är med, så att ett sammanslaget kort aldrig visar fel datum för någon av dem.
 * Antalet sökande är **inte** med: det skiljer sig mellan objekten och säger inget
 * om vilken lägenhet det är.
 */

export interface IdenticalFields {
  id: string;
  market: string;
  kommun: string;
  stadsdel: string;
  gatuadress: string;
  antalRum: number | null;
  yta: number | null;
  hyra: number | null;
  vaning: number | null;
  annonseradTill: Date | string | null;
}

export interface CardGroup<T> {
  /** Lägenheten som visas. */
  listing: T;
  /** Hur många likadana lägenheter kortet står för, den visade inräknad. */
  count: number;
}

const day = (d: Date | string | null) => (d == null ? "" : new Date(d).toISOString().slice(0, 10));

const keyOf = (l: IdenticalFields) =>
  [l.market, l.kommun, l.stadsdel, l.gatuadress, l.antalRum, l.yta, l.hyra, l.vaning, day(l.annonseradTill)].join("|");

/**
 * Grupperar i den ordning listan redan har. Varje grupp hamnar där dess första
 * lägenhet stod, så sorteringen från servern bevaras. Är någon i gruppen
 * favoritmarkerad visas den, annars den första – hjärtat på kortet ska stämma.
 */
export function groupIdentical<T extends IdenticalFields>(listings: T[], favorites?: ReadonlySet<string>): CardGroup<T>[] {
  const groups = new Map<string, CardGroup<T>>();
  for (const l of listings) {
    const key = keyOf(l);
    const g = groups.get(key);
    if (!g) groups.set(key, { listing: l, count: 1 });
    else {
      g.count += 1;
      if (favorites?.has(l.id) && !favorites.has(g.listing.id)) g.listing = l;
    }
  }
  return [...groups.values()];
}

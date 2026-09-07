"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Heart, MapPin } from "lucide-react";
import type { Listing } from "@/generated/prisma/client";
import { ListingCard } from "@/components/listing-card";
import { ListingsMap, type MapBounds, type MapPoint } from "@/components/listings-map";
import { useHoveredListing } from "@/components/hovered-listing";
import { isRecent } from "@/lib/format";
import { PAGE_SIZES, pageSizeServerSnapshot, readPageSize, subscribePageSize, writePageSize } from "@/lib/page-size";
import { LAYOUT_GRID, cardLayoutServerSnapshot, readCardLayout, subscribeCardLayout } from "@/lib/card-layout";
import { CardLayoutSwitcher } from "@/components/card-layout-switcher";
import type { Market } from "@/lib/markets";

/** Kartans markörer har ett eget tak; korten paginerar så det räcker gott. */
const MAX_MARKERS = 1500;

/**
 * Listan och kartan tillsammans.
 *
 * Hela träfflistan skickas hit en gång (hela Stockholm är ~33 kB komprimerat, mindre
 * än ett enda annonsfoto). Filtrering efter kartans utsnitt och sidbläddring sker
 * därför **helt i webbläsaren** – att panorera kartan eller byta sida kostar inte ett
 * enda anrop till servern, och belastar varken Vercel eller databasen.
 *
 * Sorteringen ligger kvar på servern: listan kommer redan sorterad, och både
 * filtrering och paginering här bevarar ordningen.
 */
export function ListingsBrowser({
  listings,
  market,
  favoriteListings,
  userRegisteredAt,
  userYears,
  canFavorite,
  filterPanel,
  sortBar,
}: {
  listings: Listing[];
  market: Market;
  /** Alla sparade favoriter i den här kön, oavsett filter och om de gått ut. */
  favoriteListings: Listing[];
  userRegisteredAt: Date | null;
  /** Uträknad på servern; se ChanceMeter. */
  userYears: number | null;
  canFavorite: boolean;
  /** Sorteringsraden renderas på servern och skickas in som färdigt innehåll. */
  filterPanel: React.ReactNode;
  sortBar: React.ReactNode;
}) {
  const t = useTranslations("listings");
  const { favorites } = useHoveredListing();
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [page, setPage] = useState(1);
  // Går att stänga av, för den som hellre bläddrar hela träfflistan.
  const [followMap, setFollowMap] = useState(true);
  const pageSize = useSyncExternalStore(subscribePageSize, readPageSize, pageSizeServerSnapshot);
  const layout = useSyncExternalStore(subscribeCardLayout, readCardLayout, cardLayoutServerSnapshot);

  // Kartan skickar nytt utsnitt vid varje moveend; en ny callback får inte
  // bygga om kartan, därför useCallback.
  const onBoundsChange = useCallback((b: MapBounds) => setBounds(b), []);

  // Rent visningsfilter, som kartutsnittet: ligger i sidans tillstånd och inte i
  // adressen, eftersom hela träfflistan redan finns i webbläsaren.
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  // Räknas på den separata listan, så utgångna favoriter syns i siffran.
  const favoriteCount = useMemo(() => favoriteListings.filter((l) => favorites.has(l.id)).length, [favoriteListings, favorites]);

  const points: MapPoint[] = useMemo(
    () =>
      listings
        .filter((l) => l.lat != null && l.lng != null)
        .slice(0, MAX_MARKERS)
        .map((l) => ({
          id: l.id,
          lat: l.lat!,
          lng: l.lng!,
          gatuadress: l.gatuadress,
          stadsdel: l.stadsdel,
          kommun: l.kommun,
          antalRum: l.antalRum,
          yta: l.yta,
          hyra: l.hyra,
          vaning: l.vaning,
          url: l.url,
          nyproduktion: l.nyproduktion,
          kotidQ1: l.kotidQ1,
          kotidQ3: l.kotidQ3,
          kotidSnitt: l.kotidSnitt,
          sokande: l.sokande,
          isNew: isRecent(l.firstSeenAt),
          favorited: favorites.has(l.id),
        })),
    [listings, favorites],
  );

  const visible = useMemo(() => {
    // Favoritläget är en sparad samling, inte en sökning: det visar allt du
    // sparat och påverkas därför varken av filtren eller av kartans utsnitt.
    // Listan krymper direkt när du avmarkerar något, eftersom `favorites` är
    // samma delade tillstånd som hjärtat på korten.
    if (onlyFavorites) return favoriteListings.filter((l) => favorites.has(l.id));

    const rows = listings;
    if (!followMap || !bounds) return rows;
    return rows.filter((l) => {
      // Annonser utan koordinater ska inte försvinna bara för att förmedlingen
      // saknar position för dem.
      if (l.lat == null || l.lng == null) return true;
      return l.lat >= bounds.south && l.lat <= bounds.north && l.lng >= bounds.west && l.lng <= bounds.east;
    });
  }, [listings, bounds, followMap, onlyFavorites, favorites, favoriteListings]);

  const hiddenByMap = visible.length < listings.length;
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  // Panorering kan krympa listan under den sida man står på.
  const current = Math.min(page, pages);
  const start = (current - 1) * pageSize;
  const shown = visible.slice(start, start + pageSize);

  return (
    <div className="space-y-6">
      {/* Sorteringen skickas in i kartans egen fastnaglade behållare. Som eget
          sticky-element fastnade den på top 0, alltså bakom kartan, och hoppade
          först ned när dess sentinel nådde toppen. */}
      <ListingsMap
        points={points}
        market={market}
        userYears={userYears}
        sticky
        header={filterPanel}
        footer={sortBar}
        onBoundsChange={onBoundsChange}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Visas bara när kartan faktiskt döljer något, så raden inte skräpar. */}
        {hiddenByMap || !followMap ? (
          <span className="inline-flex items-center gap-2 rounded-xl border border-accent-line bg-accent-soft px-3 py-1.5 text-sm text-accent-strong">
            <MapPin className="size-4 shrink-0 text-accent" />
            {followMap
              ? t("viewport.showing", { count: visible.length, total: listings.length })
              : t("viewport.showingAll", { total: listings.length })}
            <button
              type="button"
              onClick={() => {
                setFollowMap((v) => !v);
                setPage(1);
              }}
              className="font-semibold text-accent hover:underline"
            >
              {followMap ? t("viewport.showAll") : t("viewport.followMap")}
            </button>
          </span>
        ) : (
          <span />
        )}

        <label className="inline-flex items-center gap-2 text-sm text-muted">
          {canFavorite && (
            <button
              type="button"
              aria-pressed={onlyFavorites}
              onClick={() => {
                setOnlyFavorites((v) => !v);
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition ${
                onlyFavorites
                  ? "border-accent-line-strong bg-accent-soft text-accent"
                  : "border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              <Heart className={`size-3.5 ${onlyFavorites ? "fill-current" : ""}`} />
              {t("onlyFavorites")}
              <span className="text-muted">{favoriteCount}</span>
            </button>
          )}
          <CardLayoutSwitcher />
          {t("perPage.label")}
          <select
            value={pageSize}
            onChange={(e) => {
              writePageSize(Number(e.currentTarget.value));
              setPage(1);
            }}
            className="input w-auto py-1.5"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="card p-12 text-center text-muted">
          {onlyFavorites && favoriteCount === 0 ? t("noFavorites") : hiddenByMap ? t("viewport.empty") : t("empty")}
        </div>
      ) : (
        <>
        {onlyFavorites && visible.some((l) => !l.active) && (
          <p className="mb-3 text-sm text-muted">{t("favoritesExpired")}</p>
        )}
        <div className={LAYOUT_GRID[layout]}>
          {shown.map((l, i) => (
            <div key={l.id} className={onlyFavorites && !l.active ? "opacity-60" : ""}>
            <ListingCard
              listing={l}
              index={i}
              userRegisteredAt={userRegisteredAt}
              userYears={userYears}
              canFavorite={canFavorite}
              layout={layout}
            />
            </div>
          ))}
        </div>
        </>
      )}

      {pages > 1 && <Pagination page={current} pages={pages} onChange={setPage} />}
    </div>
  );
}

/** Sidbläddring med ett fönster kring aktuell sida, så raden inte växer okontrollerat. */
function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  const t = useTranslations("listings");
  const window = 2;
  const numbers: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= window) numbers.push(p);
    else if (numbers[numbers.length - 1] !== "…") numbers.push("…");
  }

  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5 text-sm" aria-label={t("pagination.label")}>
      <button
        type="button"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        aria-label={t("pagination.previous")}
        className="btn-ghost px-2 py-1.5 disabled:opacity-40"
      >
        <ChevronLeft className="size-4" />
      </button>
      {numbers.map((n, i) =>
        n === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-muted">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            aria-current={n === page ? "page" : undefined}
            onClick={() => onChange(n)}
            className={n === page ? "btn-primary px-3 py-1.5" : "btn-secondary px-3 py-1.5"}
          >
            {n}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={page === pages}
        onClick={() => onChange(page + 1)}
        aria-label={t("pagination.next")}
        className="btn-ghost px-2 py-1.5 disabled:opacity-40"
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}

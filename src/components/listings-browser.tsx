"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import type { Listing } from "@/generated/prisma/client";
import { ListingCard } from "@/components/listing-card";
import { ListingsMap, type MapBounds, type MapPoint } from "@/components/listings-map";
import { useHoveredListing } from "@/components/hovered-listing";
import { isRecent } from "@/lib/format";
import { PAGE_SIZES, pageSizeServerSnapshot, readPageSize, subscribePageSize, writePageSize } from "@/lib/page-size";
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
  userYears,
  canFavorite,
  sortBar,
}: {
  listings: Listing[];
  market: Market;
  userYears: number | null;
  canFavorite: boolean;
  /** Sorteringsraden renderas på servern och skickas in som färdigt innehåll. */
  sortBar: React.ReactNode;
}) {
  const t = useTranslations("listings");
  const { favorites } = useHoveredListing();
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [page, setPage] = useState(1);
  // Går att stänga av, för den som hellre bläddrar hela träfflistan.
  const [followMap, setFollowMap] = useState(true);
  const pageSize = useSyncExternalStore(subscribePageSize, readPageSize, pageSizeServerSnapshot);

  // Kartan skickar nytt utsnitt vid varje moveend; en ny callback får inte
  // bygga om kartan, därför useCallback.
  const onBoundsChange = useCallback((b: MapBounds) => setBounds(b), []);

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
    if (!followMap || !bounds) return listings;
    return listings.filter((l) => {
      // Annonser utan koordinater ska inte försvinna bara för att förmedlingen
      // saknar position för dem.
      if (l.lat == null || l.lng == null) return true;
      return l.lat >= bounds.south && l.lat <= bounds.north && l.lng >= bounds.west && l.lng <= bounds.east;
    });
  }, [listings, bounds, followMap]);

  const hiddenByMap = visible.length < listings.length;
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  // Panorering kan krympa listan under den sida man står på.
  const current = Math.min(page, pages);
  const start = (current - 1) * pageSize;
  const shown = visible.slice(start, start + pageSize);

  return (
    <div className="space-y-6">
      <ListingsMap points={points} market={market} userYears={userYears} sticky onBoundsChange={onBoundsChange} />

      {sortBar}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Visas bara när kartan faktiskt döljer något, så raden inte skräpar. */}
        {hiddenByMap || !followMap ? (
          <span className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm text-brand-900">
            <MapPin className="size-4 shrink-0 text-brand-700" />
            {followMap
              ? t("viewport.showing", { count: visible.length, total: listings.length })
              : t("viewport.showingAll", { total: listings.length })}
            <button
              type="button"
              onClick={() => {
                setFollowMap((v) => !v);
                setPage(1);
              }}
              className="font-semibold text-brand-700 hover:underline"
            >
              {followMap ? t("viewport.showAll") : t("viewport.followMap")}
            </button>
          </span>
        ) : (
          <span />
        )}

        <label className="inline-flex items-center gap-2 text-sm text-muted">
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
        <div className="card p-12 text-center text-muted">{hiddenByMap ? t("viewport.empty") : t("empty")}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((l, i) => (
            <ListingCard key={l.id} listing={l} index={i} userYears={userYears} canFavorite={canFavorite} />
          ))}
        </div>
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

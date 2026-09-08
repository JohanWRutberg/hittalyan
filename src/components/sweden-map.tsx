"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MARKETS, marketInfo, type Market } from "@/lib/markets";
import { MOSAIC_COLS, MOSAIC_MARKETS, MOSAIC_ROW_COUNT, MOSAIC_TILES } from "@/lib/sweden-mosaic";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/i18n/config";

/**
 * Sverige som mosaik på startsidan. Varje kö äger ett område av rutor: hovra över
 * området och kön visar sig, klicka och den tänds eller släcks på kartan.
 *
 * Rutorna är alla genomskinliga, i fyra djup (se `MosaicTile.depth`). Det är det
 * som gör mosaiken levande i stället för platt, och det är också därför kartan
 * inte har någon egen bakgrund: kortet under ska lysa igenom.
 *
 * Färgläggningen sker med `fill-opacity`, inte med olika färger per ruta. Då är
 * det en enda animerbar egenskap som ändras vid hover, och webbläsaren slipper
 * räkna om något annat än genomskinligheten.
 */

/** Rutans sida i SVG-enheter. Mellanrummet ligger inuti rutan, som marginal. */
const CELL = 10;
const INSET = 0.85;

/**
 * Genomskinlighet per djup (0–3) och tillstånd. Land utan kö ligger lågt så att
 * konturen syns utan att ta uppmärksamhet; den hovrade kön går nästan till helt
 * täckande, medan de andra tonas ned så att blicken hamnar rätt.
 */
const OPACITY = {
  land: [0.09, 0.13, 0.17, 0.22],
  /** Land som bara den rikstäckande kön förmedlar i. Svagt: det ska läsas som
   *  bakgrund, inte konkurrera med de fyra områdena ovanpå. */
  national: [0.12, 0.16, 0.2, 0.25],
  market: [0.34, 0.44, 0.54, 0.64],
  active: [0.78, 0.86, 0.93, 1],
  faded: [0.16, 0.2, 0.24, 0.28],
} as const;

export function SwedenMap({ counts, className = "" }: { counts: Partial<Record<Market, number>>; className?: string }) {
  const t = useTranslations("landing.map");
  const locale = useLocale() as Locale;
  const [hovered, setHovered] = useState<Market | null>(null);
  // Köer användaren släckt. Tom mängd = alla syns, vilket är utgångsläget.
  const [hidden, setHidden] = useState<Set<Market>>(new Set());

  const toggle = (m: Market) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (!next.delete(m)) next.add(m);
      return next;
    });

  const fillFor = (market: Market | null, depth: number) => {
    // Hela landet lyser upp när den rikstäckande kön hovras, de fyra områdena med.
    // Är den släckt lyser den inte, precis som de andra köerna.
    if (national && nationalOn && hovered === national) return { fill: `var(--market-${national})`, opacity: OPACITY.active[depth] };
    if (!market || hidden.has(market)) {
      return nationalOn
        ? { fill: `var(--market-${national})`, opacity: OPACITY.national[depth] }
        : { fill: "var(--ink)", opacity: OPACITY.land[depth] };
    }
    const state = hovered === market ? "active" : hovered ? "faded" : "market";
    return { fill: `var(--market-${market})`, opacity: OPACITY[state][depth] };
  };

  // Den rikstäckande kön har inga egna rutor – dess område är resten av landet.
  // Att hovra den tänder hela kartan, vilket säger "överallt" bättre än någon text.
  const national = MARKETS.find((m) => marketInfo(m).coverage === "national") ?? null;
  const nationalOn = national !== null && !hidden.has(national);

  const shown = hovered ? marketInfo(hovered) : null;
  const shownCount = hovered ? (counts[hovered] ?? 0) : null;

  return (
    <div className={`w-full rounded-3xl border border-line p-4 ${className}`}>
      {/*
        Rubriken byter innehåll i stället för att en tooltip följer pekaren: en
        etikett som svävar över mosaiken hamnar utanför kortet så fort området
        ligger i kanten, och måste mätas varje bildruta.
      */}
      <div className="min-h-14 px-1">
        <p className="text-sm font-semibold text-ink">{shown ? shown.short : t("title")}</p>
        <p className="mt-0.5 text-xs text-muted">
          {shown ? (
            <>
              {/* Namnet utelämnas när etiketten redan är det, som hos Boplats. */}
              {shown.name !== shown.short && `${shown.name} · `}
              <span className="text-accent">{t("count", { count: formatNumber(shownCount ?? 0, locale) })}</span>
            </>
          ) : (
            t("hint")
          )}
        </p>
      </div>

      <svg
        viewBox={`0 0 ${MOSAIC_COLS * CELL} ${MOSAIC_ROW_COUNT * CELL}`}
        className="mx-auto block h-auto w-full max-w-[16rem]"
        role="presentation"
      >
        {/*
          Land utan eget område. Är någon kö rikstäckande är det här dess yta –
          det är ju precis de orter där den är den enda kön. Finns ingen sådan tar
          gruppen inga pekarhändelser alls.
        */}
        <g
          aria-hidden="true"
          className={national ? "cursor-pointer" : "pointer-events-none"}
          onMouseEnter={national ? () => setHovered(national) : undefined}
          onMouseLeave={national ? () => setHovered((cur) => (cur === national ? null : cur)) : undefined}
          onClick={national ? () => toggle(national) : undefined}
        >
          {MOSAIC_TILES.filter((tile) => tile.market === null).map((tile) => {
            const { fill, opacity } = fillFor(null, tile.depth);
            return (
              <rect
                key={`${tile.row}-${tile.col}`}
                x={tile.col * CELL + INSET}
                y={tile.row * CELL + INSET}
                width={CELL - INSET * 2}
                height={CELL - INSET * 2}
                rx={2.2}
                fill={fill}
                fillOpacity={opacity}
                style={{ transition: "fill-opacity 220ms ease" }}
              />
            );
          })}
        </g>

        {/*
          Ett område per kö. Hela gruppen lyser upp så fort pekaren är i någon av
          dess rutor, annars hade markeringen blinkat mellan rutorna i mellanrummen.
          Grupperna är dolda för skärmläsare: knapparna under kartan är samma val,
          fast som riktiga knappar.
        */}
        {MOSAIC_MARKETS.map((market) => (
          <g
            key={market}
            aria-hidden="true"
            className="cursor-pointer"
            onMouseEnter={() => setHovered(market)}
            onMouseLeave={() => setHovered((cur) => (cur === market ? null : cur))}
            onClick={() => toggle(market)}
          >
            {MOSAIC_TILES.filter((tile) => tile.market === market).map((tile) => {
              const { fill, opacity } = fillFor(market, tile.depth);
              return (
                <rect
                  key={`${tile.row}-${tile.col}`}
                  x={tile.col * CELL + INSET}
                  y={tile.row * CELL + INSET}
                  width={CELL - INSET * 2}
                  height={CELL - INSET * 2}
                  rx={2.2}
                  fill={fill}
                  fillOpacity={opacity}
                  style={{ transition: "fill-opacity 220ms ease" }}
                />
              );
            })}
          </g>
        ))}
      </svg>

      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        {[...MOSAIC_MARKETS, ...(national ? [national] : [])].map((market) => {
          const info = marketInfo(market);
          const off = hidden.has(market);
          return (
            <button
              key={market}
              type="button"
              aria-pressed={!off}
              onMouseEnter={() => setHovered(market)}
              onMouseLeave={() => setHovered((cur) => (cur === market ? null : cur))}
              onFocus={() => setHovered(market)}
              onBlur={() => setHovered((cur) => (cur === market ? null : cur))}
              onClick={() => toggle(market)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                off ? "border-line text-faint" : "border-accent-line text-ink"
              }`}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: off ? "var(--faint)" : `var(--market-${market})` }}
              />
              {info.short}
              <span className={off ? "text-faint" : "text-muted"}>{formatNumber(counts[market] ?? 0, locale)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

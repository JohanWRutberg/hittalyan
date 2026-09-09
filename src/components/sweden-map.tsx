"use client";

import { useState, type CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MARKETS, marketInfo, type Market } from "@/lib/markets";
import { MOSAIC_COLS, MOSAIC_MARKETS, MOSAIC_ROW_COUNT, MOSAIC_TILES } from "@/lib/sweden-mosaic";
import { useMediaQuery } from "@/lib/use-media-query";
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
 * Hur fort rutorna andas, i sekunder per cykel. Spridningen är själva poängen:
 * går de i samma takt läser ögat det som ett pulserande block i stället för
 * enskilda rutor. Under ett par sekunder börjar det läsas som blink och blir
 * stressigt att ha bredvid en textmassa.
 */
const BREATH_MIN_S = 2.4;
const BREATH_MAX_S = 5.2;

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
  /*
   * Pekskärm har ingen hover, och iOS simulerar mouseenter vid tryck – samma
   * fälla som annonskorten går i. Därför ignoreras hover-händelserna helt där,
   * och områdena får i stället samma tvåstegstryck som korten: **första trycket
   * pekar ut kön** (rubriken säger vilken, området tänds), andra trycket släcker
   * eller tänder den. Områdena är omärkta, så ett enda tryck som direkt släckte
   * en kö hade lämnat användaren utan att veta vilken som försvann. Pillren är
   * märkta och behöver inget mellansteg.
   */
  const noHover = useMediaQuery("(hover: none)");
  // Köer användaren släckt. Tom mängd = alla syns, vilket är utgångsläget.
  const [hidden, setHidden] = useState<Set<Market>>(new Set());

  const toggle = (m: Market) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (!next.delete(m)) next.add(m);
      return next;
    });

  /**
   * Färg, grundgenomskinlighet – och om rutan ska andas. Bara tända köer andas:
   * släckt land ligger stilla, och den hovrade kön står still så att markeringen
   * blir ett tydligt svar och inte ännu en sak som rör sig.
   */
  const fillFor = (market: Market | null, depth: number) => {
    // Hela landet lyser upp när den rikstäckande kön hovras, de fyra områdena med.
    // Är den släckt lyser den inte, precis som de andra köerna.
    if (national && nationalOn && hovered === national)
      return { fill: `var(--market-${national})`, opacity: OPACITY.active[depth], breathing: false };
    if (!market || hidden.has(market)) {
      return nationalOn
        ? { fill: `var(--market-${national})`, opacity: OPACITY.national[depth], breathing: true }
        : { fill: "var(--ink)", opacity: OPACITY.land[depth], breathing: false };
    }
    const state = hovered === market ? "active" : hovered ? "faded" : "market";
    return { fill: `var(--market-${market})`, opacity: OPACITY[state][depth], breathing: state !== "active" };
  };

  /**
   * En ruta. Takten ligger i rutnätsdatan, och fördröjningen är **negativ**: då
   * börjar varje ruta mitt i sin egen cykel redan vid första bildrutan, i stället
   * för att hela kartan står stilla och sedan tonar ned i takt.
   */
  const tile = (t: (typeof MOSAIC_TILES)[number], market: Market | null) => {
    const { fill, opacity, breathing } = fillFor(market, t.depth);
    const duration = BREATH_MIN_S + t.speed * (BREATH_MAX_S - BREATH_MIN_S);
    return (
      <rect
        key={`${t.row}-${t.col}`}
        x={t.col * CELL + INSET}
        y={t.row * CELL + INSET}
        width={CELL - INSET * 2}
        height={CELL - INSET * 2}
        rx={2.2}
        fill={fill}
        className={`mosaic-tile pointer-events-none${breathing ? " mosaic-tile--breathing" : ""}`}
        style={
          {
            "--tile-o": opacity,
            "--tile-dur": `${duration.toFixed(2)}s`,
            "--tile-delay": `${(-t.phase * duration).toFixed(2)}s`,
          } as CSSProperties
        }
      />
    );
  };

  // Den rikstäckande kön har inga egna rutor – dess område är resten av landet.
  // Att hovra den tänder hela kartan, vilket säger "överallt" bättre än någon text.
  const national = MARKETS.find((m) => marketInfo(m).coverage === "national") ?? null;
  const nationalOn = national !== null && !hidden.has(national);

  /** Händelser för ett område på kartan, med eller utan hover. */
  const areaProps = (market: Market) =>
    noHover
      ? { onClick: () => (hovered === market ? toggle(market) : setHovered(market)) }
      : {
          onMouseEnter: () => setHovered(market),
          onMouseLeave: () => setHovered((cur) => (cur === market ? null : cur)),
          onClick: () => toggle(market),
        };

  const shown = hovered ? marketInfo(hovered) : null;
  const shownCount = hovered ? (counts[hovered] ?? 0) : null;

  /**
   * Osynlig träffyta över hela cellen, mellanrummet inräknat.
   *
   * Utan den tappas hovern varje gång pekaren passerar glappet mellan två rutor i
   * samma område, och markeringen blinkar till för varje ruta man drar musen
   * över. Rutorna är ritade med marginal inuti cellen just för att mosaiken ska
   * få luft – men luften ska bara synas, inte kännas. Ytorna ligger kant i kant,
   * så inom ett område släpper hovern aldrig, och mellan två områden byter den
   * direkt utan att passera ett dödläge.
   */
  const hitTile = (t: (typeof MOSAIC_TILES)[number]) => (
    <rect
      key={`hit-${t.row}-${t.col}`}
      x={t.col * CELL}
      y={t.row * CELL}
      width={CELL}
      height={CELL}
      fill="transparent"
    />
  );

  return (
    <div className={`w-full rounded-3xl border border-line p-4 ${className}`}>
      {/*
        Rubriken byter innehåll i stället för att en tooltip följer pekaren: en
        etikett som svävar över mosaiken hamnar utanför kortet så fort området
        ligger i kanten, och måste mätas varje bildruta.

        Här står köns **fulla namn**, inte den korta etiketten. Pillren under
        kartan är trånga och nöjer sig med "Stockholm", men i rubriken finns
        plats, och där är det värt att säga att det är en bostadsförmedling.
        Höjden rymmer två rader så att kartan inte hoppar när namnet är långt.
      */}
      <div className="min-h-16 px-1">
        <p className="text-sm font-semibold text-ink">{shown ? shown.name : t("title")}</p>
        <p className="mt-0.5 text-xs text-muted">
          {shown ? (
            <span className="text-accent">{t("count", { count: formatNumber(shownCount ?? 0, locale) })}</span>
          ) : (
            // Hovra går inte på en pekskärm. Instruktionen ska beskriva det man
            // faktiskt kan göra, inte det som råkar gälla på en mus.
            t(noHover ? "hintTouch" : "hint")
          )}
        </p>
      </div>

      {/*
        Kartan är hög och smal, och det är just det som gör den användbar i
        mobilen: i stället för att staplas under texten och göra hjältekortet
        ännu högre ställer den sig **bredvid** kölistan. Formen som är en
        spalt på skrivbordet blir en rad på telefonen, och blocket blir lika
        högt som listan i stället för dubbelt så högt.
      */}
      <div className="flex items-center gap-4 sm:block">
      <svg
        viewBox={`0 0 ${MOSAIC_COLS * CELL} ${MOSAIC_ROW_COUNT * CELL}`}
        className="block h-auto w-28 shrink-0 sm:mx-auto sm:w-full sm:max-w-[16rem]"
        role="presentation"
      >
        {/*
          Land utan eget område. Är någon kö rikstäckande är det här dess yta –
          det är ju precis de orter där den är den enda kön. Finns ingen sådan tar
          gruppen inga pekarhändelser alls.
        */}
        <g aria-hidden="true" className={national ? "cursor-pointer" : "pointer-events-none"} {...(national ? areaProps(national) : {})}>
          {MOSAIC_TILES.filter((t) => t.market === null).map((t) => tile(t, null))}
          {MOSAIC_TILES.filter((t) => t.market === null).map(hitTile)}
        </g>

        {/*
          Ett område per kö. Hela gruppen lyser upp så fort pekaren är i någon av
          dess rutor, annars hade markeringen blinkat mellan rutorna i mellanrummen.
          Grupperna är dolda för skärmläsare: knapparna under kartan är samma val,
          fast som riktiga knappar.
        */}
        {MOSAIC_MARKETS.map((market) => (
          <g key={market} aria-hidden="true" className="cursor-pointer" {...areaProps(market)}>
            {MOSAIC_TILES.filter((t) => t.market === market).map((t) => tile(t, market))}
            {MOSAIC_TILES.filter((t) => t.market === market).map(hitTile)}
          </g>
        ))}
      </svg>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:mt-4 sm:flex-row sm:flex-wrap sm:justify-center">
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
              className={`flex w-full items-center gap-1.5 rounded-full border px-3 py-2 text-xs transition sm:w-auto sm:px-2.5 sm:py-1 ${
                off ? "border-line text-faint" : "border-accent-line text-ink"
              }`}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: off ? "var(--faint)" : `var(--market-${market})` }}
              />
              <span className="truncate">{info.short}</span>
              {/* Antalet skjuts ut till kanten i mobilens lista, men ligger tätt
                  intill namnet när pillren radas upp på skrivbordet. */}
              <span className={`ml-auto sm:ml-0 ${off ? "text-faint" : "text-muted"}`}>
                {formatNumber(counts[market] ?? 0, locale)}
              </span>
            </button>
          );
        })}
      </div>
      </div>
    </div>
  );
}

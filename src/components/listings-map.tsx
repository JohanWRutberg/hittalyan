"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import type * as MapLibre from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Maximize2, Minimize2, MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatKr, formatRum, formatVaning, formatYta } from "@/lib/format";
import { chanceFor, chanceRange } from "@/lib/chance";
import { formatYearsShort } from "@/lib/format";
import { useHoveredListing } from "@/components/hovered-listing";
import { marketInfo, type Market } from "@/lib/markets";
import { useIsDesktop } from "@/lib/use-media-query";
import type { Locale } from "@/i18n/config";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  gatuadress: string;
  stadsdel: string;
  kommun: string;
  antalRum: number | null;
  yta: number | null;
  hyra: number | null;
  vaning: number | null;
  url: string;
  nyproduktion: boolean;
  kotidQ1: number | null;
  kotidQ3: number | null;
  kotidSnitt: number | null;
  sokande: number | null;
  isNew: boolean;
}

interface Group {
  key: string;
  lat: number;
  lng: number;
  items: MapPoint[];
  hasNew: boolean;
}

// OpenFreeMap: fria vektorkartor utan API-nyckel. Positron är den ljusa, rena stilen.
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

const MAX_MARKERS = 1500;
const MIN_FIT_ZOOM = 8.3;

/**
 * maplibre-gl levereras som UMD. Beroende på bundler hamnar API:t antingen
 * som namnexporter eller under `default`, så vi hanterar båda.
 */
let workerConfigured = false;
async function loadMapLibre(): Promise<typeof MapLibre> {
  const mod = (await import("maplibre-gl")) as unknown as { default?: typeof MapLibre; Map?: unknown };
  const ml = typeof mod.Map === "function" ? (mod as unknown as typeof MapLibre) : mod.default;
  if (!ml || typeof ml.Map !== "function") throw new Error("maplibre-gl kunde inte laddas");
  if (!workerConfigured) {
    // Bundlern kan inte räkna ut var worker-filen ligger; vi serverar den själva
    // (kopieras av scripts/copy-maplibre-worker.mjs).
    ml.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    workerConfigured = true;
  }
  return ml;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function groupPoints(points: MapPoint[]): Group[] {
  const map = new Map<string, Group>();
  for (const p of points.slice(0, MAX_MARKERS)) {
    const key = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
    const g = map.get(key);
    if (g) {
      g.items.push(p);
      g.hasNew ||= p.isNew;
    } else {
      map.set(key, { key, lat: p.lat, lng: p.lng, items: [p], hasNew: p.isNew });
    }
  }
  return [...map.values()];
}

interface PopupText {
  more: (n: number) => string;
  isNew: string;
  newBuild: string;
  chanceLabel: (level: string) => string;
  chanceTitle: (q1: number, q3: number) => string;
  averageTitle: (years: string) => string;
  applicants: (count: number) => string;
  etAl: string;
  locale: Locale;
}

function popupHtml(g: Group, userYears: number | null, tx: PopupText) {
  const first = g.items[0];
  const rows = g.items
    .slice(0, 6)
    .map((p) => {
      // Väst har bara ett områdessnitt, Syd och Uppsala ingen kötidsstatistik alls.
      const range = chanceRange(p);
      const c = chanceFor(userYears, range?.q1, range?.q3);
      const title =
        p.kotidQ1 != null && p.kotidQ3 != null
          ? tx.chanceTitle(p.kotidQ1, p.kotidQ3)
          : p.kotidSnitt != null
            ? tx.averageTitle(formatYearsShort(p.kotidSnitt, tx.locale))
            : "";
      const chance =
        c.level !== "unknown"
          ? `<span class="lm-popup__chance lm-popup__chance--${c.level}" title="${escapeHtml(title)}">${escapeHtml(tx.chanceLabel(c.level))}</span>`
          : p.sokande != null
            ? `<span class="lm-popup__applicants">${escapeHtml(tx.applicants(p.sokande))}</span>`
            : "";
      return `
      <a class="lm-popup__row" href="${escapeHtml(p.url)}" target="_blank" rel="noreferrer">
        <span class="lm-popup__main">${escapeHtml(formatRum(p.antalRum, tx.locale))} · ${escapeHtml(formatYta(p.yta))} · ${escapeHtml(formatVaning(p.vaning, tx.locale))}</span>
        <span class="lm-popup__rent">${escapeHtml(formatKr(p.hyra, tx.locale))}</span>
        ${chance}
        ${p.isNew ? `<span class="lm-popup__new">${escapeHtml(tx.isNew)}</span>` : ""}
      </a>`;
    })
    .join("");
  const more = g.items.length > 6 ? `<div class="lm-popup__more">${escapeHtml(tx.more(g.items.length - 6))}</div>` : "";
  const sameStreet = g.items.every((p) => p.gatuadress === first.gatuadress);
  const title = sameStreet ? first.gatuadress : `${first.gatuadress} ${tx.etAl}`;
  return `
    <div class="lm-popup">
      <div class="lm-popup__title">${escapeHtml(title)}</div>
      <div class="lm-popup__sub">${escapeHtml(first.stadsdel)} · ${escapeHtml(first.kommun)}${first.nyproduktion ? ` · ${escapeHtml(tx.newBuild)}` : ""}</div>
      <div class="lm-popup__rows">${rows}</div>
      ${more}
    </div>`;
}

function markerElement(g: Group, index: number) {
  // Yttre element positioneras av MapLibre (via transform) och får därför inte animeras.
  // All animation sker på det inre elementet.
  const el = document.createElement("div");
  el.className = "lm-marker";
  el.dataset.ids = g.items.map((i) => i.id).join(",");
  el.title = g.items[0].gatuadress;
  const inner = document.createElement("div");
  inner.className = `lm-marker__inner${g.hasNew ? " lm-marker--new" : ""}`;
  inner.style.setProperty("--delay", `${Math.min(index, 60) * 12}ms`);
  inner.innerHTML = `
    <span class="lm-marker__halo"></span>
    <span class="lm-marker__pin">${g.items.length > 1 ? `<span class="lm-marker__count">${g.items.length}</span>` : ""}</span>
  `;
  el.appendChild(inner);
  return el;
}

export function ListingsMap({
  points,
  market,
  userYears = null,
  sticky = false,
}: {
  points: MapPoint[];
  /** Förmedlingen som visas; dess stad är kartans utgångsläge */
  market: Market;
  userYears?: number | null;
  sticky?: boolean;
}) {
  const { lat, lng } = marketInfo(market).center;
  const center: [number, number] = [lng, lat];
  const t = useTranslations("listings.map");
  const tChance = useTranslations("chance");
  const tListing = useTranslations("listings");
  const locale = useLocale() as Locale;
  const { hovered } = useHoveredListing();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const stuck = sticky && !expanded;
  const isDesktop = useIsDesktop();
  // Är kartan just nu fastnaglad (scrollad förbi sin plats i flödet)? Mäts med en
  // sentinel ovanför kortet, så att vi slipper läsa positioner under scroll.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuckNow, setStuckNow] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !stuck) return;
    const io = new IntersectionObserver(([e]) => setStuckNow(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [stuck]);
  // På mobil döljs kartans rubrikrad när kartan är fastnaglad, så själva kartan ligger högst upp
  const hideHeader = stuckNow && !isDesktop;

  // Initiera kartan en gång
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;
    (async () => {
      try {
        const maplibregl = await loadMapLibre();
        if (cancelled || !containerRef.current) return;
        const m = new maplibregl.Map({
          container: containerRef.current,
          style: STYLE_URL,
          center,
          zoom: 9,
          attributionControl: { compact: true },
          cooperativeGestures: true,
        });
        map = m;
        m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        m.addControl(new maplibregl.FullscreenControl(), "top-right");
        m.on("load", () => {
          if (!cancelled) setReady(true);
        });
        m.on("error", (e) => {
          if (!m.loaded()) {
            console.error("[karta]", e.error);
            setFailed(true);
          }
        });
        mapRef.current = m;
        if (process.env.NODE_ENV !== "production") (window as unknown as { __hittaLyanMap?: MapLibreMap }).__hittaLyanMap = m;
      } catch (e) {
        console.error("[karta]", e);
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map?.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- kartan skapas en gång; byte av förmedling flyttar kameran i effekten nedan i stället för att bygga om kartan
  }, []);

  // Uppdatera markörer när annonserna ändras (nytt filter)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;
    (async () => {
      const maplibregl = await loadMapLibre();
      if (cancelled) return;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const groups = groupPoints(points);
      const bounds = new maplibregl.LngLatBounds();
      groups.forEach((g, i) => {
        const popup = new maplibregl.Popup({ offset: 22, maxWidth: "320px", closeButton: false }).setHTML(
          popupHtml(g, userYears, {
            more: (n) => t("popupMore", { count: n }),
            isNew: t("popupNew"),
            newBuild: tListing("tags.nyproduktion"),
            chanceLabel: (level) => tChance(`${level}.label`),
            chanceTitle: (q1, q3) => t("popupChanceTitle", { q1, q3 }),
            averageTitle: (years) => t("popupAverageTitle", { years }),
            applicants: (count) => tListing("card.applicants", { count }),
            etAl: t("etAl"),
            locale,
          }),
        );
        const marker = new maplibregl.Marker({ element: markerElement(g, i), anchor: "bottom" })
          .setLngLat([g.lng, g.lat])
          .setPopup(popup)
          .addTo(map);
        markersRef.current.push(marker);
        bounds.extend([g.lng, g.lat]);
      });

      if (groups.length > 0) {
        // Enstaka annonser långt bort (Eskilstuna, Norrtälje) ska inte zooma ut hela kartan;
        // då hamnar vi hellre på stadens centrum och låter användaren zooma själv.
        const camera = map.cameraForBounds(bounds, { padding: 48, maxZoom: 15 });
        if (camera && (camera.zoom ?? 0) < MIN_FIT_ZOOM) {
          map.easeTo({ center, zoom: MIN_FIT_ZOOM, duration: 900, essential: true });
        } else {
          map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 900, essential: true });
        }
      } else {
        map.easeTo({ center, zoom: 9, duration: 600 });
      }
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- översättarna är stabila per språk, locale räcker som beroende
  }, [points, ready, userYears, locale, market]);

  // Markera markören för det kort som hovras i listan
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const markers = container.querySelectorAll<HTMLElement>(".lm-marker");
    markers.forEach((m) => {
      const ids = (m.dataset.ids ?? "").split(",");
      m.classList.toggle("lm-marker--active", hovered != null && ids.includes(String(hovered)));
    });
  }, [hovered, points, ready]);

  // Låt kartan räkna om sin storlek när höjden ändras
  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.resize(), 320);
    return () => clearTimeout(t);
  }, [expanded, stuck]);

  const buildings = groupPoints(points).length;

  return (
    <>
      {/* Sentinel: när den scrollat ovanför skärmen är kartan fastnaglad. Ingen höjd, ingen marginal. */}
      {stuck && <div ref={sentinelRef} aria-hidden className="h-0 !m-0" />}
    <div
      className={`card overflow-hidden ${stuck ? "sticky top-0 z-20 will-change-transform transition-transform duration-300 ease-out motion-reduce:transition-none" : ""}`}
      // Fastnaglad karta ligger på top 0 och skjuts ned med en transform (GPU, inget
      // layoutarbete) så mycket som menyn är hög, i stället för att animera top.
      style={stuck && stuckNow ? { transform: "translateY(var(--nav-h, 0px))" } : undefined}
    >
      <div
        className={`flex items-center justify-between gap-3 overflow-hidden px-5 transition-[max-height,opacity,padding] duration-200 ease-out motion-reduce:transition-none ${
          hideHeader ? "max-h-0 py-0 opacity-0" : "max-h-14 py-3"
        }`}
        aria-hidden={hideHeader || undefined}
      >
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <MapPin className="size-4 shrink-0 text-brand-600" />
          {t("title")}
          <span className="truncate font-normal text-muted">
            · {t("summary", { listings: points.length, buildings })}
            {points.length > MAX_MARKERS && t("showing", { max: MAX_MARKERS })}
          </span>
        </div>
        <button type="button" onClick={() => setExpanded(!expanded)} className="btn-ghost px-2.5 py-1.5 text-xs" title={expanded ? t("smaller") : t("larger")}>
          {expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          {expanded ? t("smaller") : t("larger")}
        </button>
      </div>
      <div className={`relative border-t border-line bg-canvas transition-[height] duration-300 ease-out ${expanded ? "h-[70vh] min-h-[420px]" : "h-44 sm:h-72"}`}>
        <div ref={containerRef} className="h-full w-full" style={{ position: "absolute", inset: 0 }} />
        {!ready && !failed && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted">
            <span className="chip animate-pulse">{t("loading")}</span>
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted">{t("failed")}</div>
        )}
      </div>
    </div>
    </>
  );
}

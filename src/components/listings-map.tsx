"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Maximize2, Minimize2, MapPin } from "lucide-react";
import { formatKr, formatRum, formatVaning, formatYta } from "@/lib/format";

export interface MapPoint {
  id: number;
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
const STOCKHOLM: [number, number] = [18.07, 59.33];
const MAX_MARKERS = 1500;

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

function popupHtml(g: Group) {
  const first = g.items[0];
  const rows = g.items
    .slice(0, 6)
    .map(
      (p) => `
      <a class="lm-popup__row" href="${escapeHtml(p.url)}" target="_blank" rel="noreferrer">
        <span class="lm-popup__main">${escapeHtml(formatRum(p.antalRum))} · ${escapeHtml(formatYta(p.yta))} · ${escapeHtml(formatVaning(p.vaning))}</span>
        <span class="lm-popup__rent">${escapeHtml(formatKr(p.hyra))}</span>
        ${p.isNew ? '<span class="lm-popup__new">Ny</span>' : ""}
      </a>`,
    )
    .join("");
  const more = g.items.length > 6 ? `<div class="lm-popup__more">+ ${g.items.length - 6} till på samma adress</div>` : "";
  const sameStreet = g.items.every((p) => p.gatuadress === first.gatuadress);
  const title = sameStreet ? first.gatuadress : `${first.gatuadress} m.fl.`;
  return `
    <div class="lm-popup">
      <div class="lm-popup__title">${escapeHtml(title)}</div>
      <div class="lm-popup__sub">${escapeHtml(first.stadsdel)} · ${escapeHtml(first.kommun)}${first.nyproduktion ? " · Nyproduktion" : ""}</div>
      <div class="lm-popup__rows">${rows}</div>
      ${more}
    </div>`;
}

function markerElement(g: Group, index: number) {
  const el = document.createElement("div");
  el.className = `lm-marker${g.hasNew ? " lm-marker--new" : ""}`;
  el.style.setProperty("--delay", `${Math.min(index, 60) * 12}ms`);
  el.innerHTML = `
    <span class="lm-marker__halo"></span>
    <span class="lm-marker__pin">${g.items.length > 1 ? `<span class="lm-marker__count">${g.items.length}</span>` : ""}</span>
  `;
  el.title = `${g.items[0].gatuadress}${g.items.length > 1 ? ` (${g.items.length} lägenheter)` : ""}`;
  return el;
}

export function ListingsMap({ points }: { points: MapPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Initiera kartan en gång
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;
    (async () => {
      try {
        const maplibregl = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;
        const m = new maplibregl.Map({
          container: containerRef.current,
          style: STYLE_URL,
          center: STOCKHOLM,
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
  }, []);

  // Uppdatera markörer när annonserna ändras (nytt filter)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled) return;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const groups = groupPoints(points);
      const bounds = new maplibregl.LngLatBounds();
      groups.forEach((g, i) => {
        const popup = new maplibregl.Popup({ offset: 22, maxWidth: "320px", closeButton: false }).setHTML(popupHtml(g));
        const marker = new maplibregl.Marker({ element: markerElement(g, i), anchor: "bottom" })
          .setLngLat([g.lng, g.lat])
          .setPopup(popup)
          .addTo(map);
        markersRef.current.push(marker);
        bounds.extend([g.lng, g.lat]);
      });

      if (groups.length > 0) {
        map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 900, essential: true });
      } else {
        map.easeTo({ center: STOCKHOLM, zoom: 9, duration: 600 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [points, ready]);

  // Låt kartan räkna om sin storlek när höjden ändras
  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.resize(), 320);
    return () => clearTimeout(t);
  }, [expanded]);

  const buildings = groupPoints(points).length;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="size-4 text-brand-600" />
          Karta
          <span className="font-normal text-muted">
            · {points.length} {points.length === 1 ? "lägenhet" : "lägenheter"} i {buildings} {buildings === 1 ? "hus" : "hus"}
            {points.length > MAX_MARKERS && ` (visar ${MAX_MARKERS})`}
          </span>
        </div>
        <button type="button" onClick={() => setExpanded(!expanded)} className="btn-ghost px-2.5 py-1.5 text-xs" title={expanded ? "Mindre karta" : "Större karta"}>
          {expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          {expanded ? "Mindre" : "Större"}
        </button>
      </div>
      <div className={`relative border-t border-line bg-canvas transition-[height] duration-300 ease-out ${expanded ? "h-[70vh] min-h-[420px]" : "h-72"}`}>
        <div ref={containerRef} className="absolute inset-0" />
        {!ready && !failed && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted">
            <span className="chip animate-pulse">Laddar karta…</span>
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted">Kartan kunde inte laddas just nu.</div>
        )}
      </div>
    </div>
  );
}

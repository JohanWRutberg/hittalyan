"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Förstoring av en annons bilder.
 *
 * Två lägen, av samma skäl som resten av gränssnittet har två: på skrivbordet är
 * en modal med bilden hel och luft runt om det stilrena valet, medan en telefon
 * inte har någon luft att ge bort. Där tar bilden hela skärmen.
 *
 * **Bilderna är nästan alltid liggande, och telefonen står upp.** Att passa in
 * hela bilden i skärmens bredd hade lämnat två svarta fält och en bild i
 * frimärksstorlek. I stället fyller bilden skärmens **höjd** – överkant mot
 * överkant, underkant mot underkant – och det som inte får plats på bredden
 * panoreras fram genom att dra. Bilden öppnas alltid centrerad, så man börjar
 * mitt i motivet och drar åt det håll man vill titta.
 *
 * Panoreringen är vanlig sidledsscroll och inte drag med pekarhändelser: det ger
 * tröghet, studs och kinetik gratis, precis som resten av systemet beter sig.
 *
 * Att svepa panorerar alltså – det byter **inte** bild. Därför finns pilarna
 * alltid, tillsammans med ett kryss och en räknare.
 *
 * Renderas i en portal till `document.body`. Korten är `motion.div` med
 * `transform`, och ett transformerat föräldraelement gör `position: fixed`
 * relativt kortet i stället för fönstret – modalen hade hamnat inuti kortet.
 */
export function ImageLightbox({
  images,
  alt,
  index,
  onIndex,
  onClose,
}: {
  images: string[];
  alt: string;
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations("listings.card");
  const panRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const count = images.length;

  const go = useCallback(
    (delta: number) => onIndex((index + delta + count) % count),
    [count, index, onIndex],
  );

  /** Börja mitt i bilden. Ligger den helt inom skärmen händer ingenting. */
  const center = useCallback(() => {
    const el = panRef.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);

  // Sidan bakom ska inte kunna scrollas medan bilden är uppe.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Tangentbordet: piltangenter byter bild, Escape stänger.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && count > 1) go(-1);
      else if (e.key === "ArrowRight" && count > 1) go(1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, go, onClose]);

  /*
   * Fokus flyttas in i modalen, så att tabb fortsätter bland dess knappar och
   * inte bland korten bakom. Fokus läggs på själva dialogen och inte på krysset:
   * en knapp som får fokus programmatiskt ritar sin fokusring direkt, och en
   * markerad knapp innan man rört tangentbordet ser ut som ett misstag. När
   * modalen stängs går fokus tillbaka dit det kom ifrån.
   */
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    rootRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  // Ny bild, eller vänt på telefonen: centrera om.
  useEffect(() => {
    center();
    window.addEventListener("resize", center);
    return () => window.removeEventListener("resize", center);
  }, [center, index]);

  // Ingen kontroll av att vi står i webbläsaren behövs: komponenten renderas
  // först efter ett klick, alltså aldrig på servern.
  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      tabIndex={-1}
      className="fixed inset-0 z-50 outline-none animate-[lightbox-in_180ms_ease-out] bg-black/95 sm:bg-black/80"
    >
      {/*
        Panoreringsytan. Centreringen ligger på det inre elementet och inte på
        scroll-behållaren med flit: `justify-content: center` på själva
        behållaren gör bildens vänstra del oåtkomlig när den svämmar över.

        Det inre elementet måste vara `w-max` och inte bara `min-w-full`. En
        vanlig blockruta blir lika bred som behållaren och växer **inte** med
        innehåll som svämmar över, så bilden hängde ut åt båda hållen medan
        scrollbredden bara räknade den högra halvan: de yttersta 255 pixlarna
        till vänster gick inte att nå. Med `w-max` blir rutan lika bred som
        bilden, och båda kanterna går att panorera fram.
      */}
      <div
        ref={panRef}
        onClick={(e) => {
          // Klick vid sidan av bilden stänger; klick på bilden gör det inte.
          if (e.target === e.currentTarget) onClose();
        }}
        className="absolute inset-0 overflow-x-auto overflow-y-hidden overscroll-contain sm:overflow-hidden"
      >
        <div className="flex h-full w-max min-w-full items-center justify-center sm:p-6 md:p-12">
          {/* eslint-disable-next-line @next/next/no-img-element -- medvetet: bilderna ligger färdigskalade hos förmedlingen, se listing-images.tsx */}
          <img
            key={images[index]}
            src={images[index]}
            alt={alt}
            decoding="async"
            onLoad={center}
            draggable={false}
            className="h-full w-auto max-w-none select-none sm:h-auto sm:max-h-full sm:max-w-full sm:rounded-2xl sm:shadow-lift"
          />
        </div>
      </div>

      {/* Överlägg: fast svart platta och vit text i båda lägena, som på korten –
          de ligger mot ett foto och inte mot gränssnittets yta. */}
      <button
        type="button"
        onClick={onClose}
        aria-label={t("closeImage")}
        className="absolute right-3 grid size-11 place-items-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
        style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <X className="size-5" />
      </button>

      {count > 1 && (
        <>
          <span
            className="pointer-events-none absolute left-3 inline-flex h-8 items-center rounded-full bg-black/55 px-3 text-xs font-medium text-white"
            style={{ top: "max(1.125rem, calc(env(safe-area-inset-top) + 0.375rem))" }}
          >
            {index + 1}/{count}
          </span>
          <Arrow side="left" label={t("prevImage")} onClick={() => go(-1)}>
            <ChevronLeft className="size-6" />
          </Arrow>
          <Arrow side="right" label={t("nextImage")} onClick={() => go(1)}>
            <ChevronRight className="size-6" />
          </Arrow>
        </>
      )}
    </div>,
    document.body,
  );
}

/**
 * Pilarna ligger fast i skärmens kant, inte i bildens: bilden kan vara bredare
 * än skärmen och flytta sig medan man panorerar, och en knapp som glider iväg
 * med motivet går inte att sikta på.
 */
function Arrow({
  side,
  label,
  onClick,
  children,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`absolute top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white transition hover:bg-black/75 ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      {children}
    </button>
  );
}

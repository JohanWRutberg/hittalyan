"use client";

import { useRef, useState } from "react";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { ImageLightbox } from "@/components/image-lightbox";

/**
 * Bildspel på annonskortet. Bilderna ligger kvar hos förmedlingen och länkas hit,
 * så vi laddar dem lätt (`loading="lazy"`) och kör medvetet **inte** next/image:
 * Vercels Hobby-plan har en månadskvot för bildoptimeringar som ~1 400 annonser
 * med flera bilder var skulle äta upp i onödan. Bilderna är redan färdigskalade.
 *
 * Ligger utanför kortets <a>, eftersom knappar inte får ligga i en länk.
 *
 * **Bläddra genom att dra**, med fingret eller med musen. Bilden följer med medan
 * man drar och grannbilden glider in från sidan; släpper man efter en bit – eller
 * med en snabb svepning – byter den, annars fjädrar den tillbaka. Det bygger på
 * pekarhändelser, så samma kod gäller för finger, mus och penna.
 *
 * - `touch-action: pan-y`: webbläsaren sköter lodrät scroll själv, och bara de
 *   vågräta rörelserna kommer hit. Annars hade en tumme som scrollar listan fastnat
 *   i bildspelet.
 * - Riktningen avgörs efter några pixlar: är rörelsen mest lodrät släpps den.
 * - Ett klick förstorar bilden, men inte efter en dragning – annars öppnades
 *   förstoringen varje gång man släppte musknappen.
 * - Grannbilderna finns bara i DOM:en medan man drar; korten kan vara 60 på en sida.
 */

/** Hur långt man måste dra för att byta bild: minst så här många pixlar … */
const SWIPE_MIN_PX = 40;
/** … eller så stor andel av bildens bredd, om den är större. */
const SWIPE_MIN_SHARE = 0.18;
/** En snabb svepning byter bild även om den är kort (pixlar per millisekund). */
const FLICK_SPEED = 0.4;
/** Hur långt pekaren ska röra sig innan vi avgör om det är vågrätt eller lodrätt. */
const DECIDE_AFTER_PX = 6;
export function ListingImages({ images, alt, fill }: { images: string[]; alt: string; fill?: boolean }) {
  const t = useTranslations("listings.card");
  const [index, setIndex] = useState(0);
  // Förstoringen delar bildnummer med kortet: stänger man den står kortet kvar
  // på den bild man tittade på, i stället för att hoppa tillbaka till den första.
  const [zoomed, setZoomed] = useState(false);

  // Dragning: hur långt bilden följt med pekaren, och – efter att man släppt – åt
  // vilket håll den glider (1 = nästa, -1 = föregående, 0 = tillbaka).
  const [dragX, setDragX] = useState<number | null>(null);
  const [settling, setSettling] = useState<-1 | 0 | 1 | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number; t: number; horizontal: boolean | null } | null>(null);
  // Bildens bredd, mätt när dragningen börjar. Den styr hur långt bilden glider.
  const [width, setWidth] = useState(0);
  const suppressClick = useRef(false);

  // Alla annonser har inte bilder – en del publiceras helt utan. De får en
  // platshållare så att korten blir lika höga och rutnätet inte hackar.
  if (!images.length) return <ImagePlaceholder fill={fill} />;

  const count = images.length;
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);
  const at = (delta: number) => images[(index + delta + count) % count];

  const finish = (dir: -1 | 0 | 1) => {
    if (dir !== 0) go(dir);
    setSettling(null);
    setDragX(null);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    suppressClick.current = false;
    if (count < 2 || settling !== null || (e.pointerType === "mouse" && e.button !== 0)) return;
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), horizontal: null };
    // Grannbilderna börjar laddas redan här, så att de finns när de glider in.
    new Image().src = at(1);
    new Image().src = at(-1);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.horizontal === null) {
      if (Math.abs(dx) < DECIDE_AFTER_PX && Math.abs(dy) < DECIDE_AFTER_PX) return;
      g.horizontal = Math.abs(dx) > Math.abs(dy);
      if (!g.horizontal) {
        gesture.current = null;
        return;
      }
      // Pekaren fångas så att dragningen fortsätter även om den lämnar bilden.
      e.currentTarget.setPointerCapture(e.pointerId);
      suppressClick.current = true;
      setWidth(boxRef.current?.offsetWidth ?? 0);
    }
    setDragX(dx);
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.id) return;
    gesture.current = null;
    if (!g.horizontal || dragX === null) return;
    const dx = dragX;
    const speed = dx / Math.max(1, performance.now() - g.t);
    const needed = Math.max(SWIPE_MIN_PX, width * SWIPE_MIN_SHARE);
    const dir: -1 | 0 | 1 =
      dx <= -needed || (speed <= -FLICK_SPEED && dx < -15) ? 1 : dx >= needed || (speed >= FLICK_SPEED && dx > 15) ? -1 : 0;
    // Utan animation – reducerad rörelse, eller ingenting att glida – är vi klara direkt.
    // Annars kommer inget transitionend, och bildspelet hade fastnat mitt i.
    const target = dir === 1 ? -width : dir === -1 ? width : 0;
    if (target === dx || window.matchMedia("(prefers-reduced-motion: reduce)").matches) finish(dir);
    else setSettling(dir);
  };

  const offset = settling === 1 ? -width : settling === -1 ? width : settling === 0 ? 0 : (dragX ?? 0);
  const moving = dragX !== null || settling !== null;

  return (
    <div
      ref={boxRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      className={`group/img relative w-full touch-pan-y select-none overflow-hidden bg-canvas ${
        fill ? "h-full min-h-28" : "aspect-16/10"
      } ${dragX !== null ? "cursor-grabbing" : ""}`}
    >
      <div
        className={`relative size-full ${settling !== null ? "transition-transform duration-300 ease-out" : ""}`}
        style={moving ? { transform: `translateX(${offset}px)` } : undefined}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && settling !== null) finish(settling);
        }}
      >
      {/* Bilden är en knapp: ett klick förstorar den. Kortet runt omkring är en
          länk till annonsen hos förmedlingen, men bildspelet ligger utanför den
          länken, så de två klicken krockar inte. */}
      <button
        type="button"
        onClick={() => {
          // En dragning slutar också med ett klick; det ska inte öppna förstoringen.
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          setZoomed(true);
        }}
        aria-label={t("openImage")}
        className={`block size-full ${dragX !== null ? "cursor-grabbing" : "cursor-zoom-in"}`}
      >
        {/* Bara den aktuella bilden ligger i DOM:en; korten kan vara 60 på en sida. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- medvetet: next/image skulle förbruka Vercels kvot för bildoptimeringar på bilder som redan är färdigskalade hos förmedlingen */}
        <img
          src={images[index]}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="size-full object-cover"
          // Trasiga bild-URL:er hos källan ska inte lämna ett brutet ikonkryss.
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
      </button>
      {/* Grannbilderna ligger bredvid, utanför synfältet, och glider in med dragningen. */}
      {moving && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- se ovan */}
          <img src={at(-1)} alt="" aria-hidden draggable={false} className="absolute inset-y-0 right-full size-full object-cover" />
          {/* eslint-disable-next-line @next/next/no-img-element -- se ovan */}
          <img src={at(1)} alt="" aria-hidden draggable={false} className="absolute inset-y-0 left-full size-full object-cover" />
        </>
      )}
      </div>

      {zoomed && (
        <ImageLightbox
          images={images}
          alt={alt}
          index={index}
          onIndex={setIndex}
          onClose={() => setZoomed(false)}
        />
      )}

      {count > 1 && (
        <>
          <NavButton side="left" label={t("prevImage")} onClick={() => go(-1)}>
            <ChevronLeft className="size-4" />
          </NavButton>
          <NavButton side="right" label={t("nextImage")} onClick={() => go(1)}>
            <ChevronRight className="size-4" />
          </NavButton>
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1">
            {images.slice(0, 8).map((_, i) => (
              <span
                key={i}
                className={`size-1.5 rounded-full transition ${
                  i === index ? "bg-surface" : "bg-surface/50"
                } shadow-[0_0_2px_rgb(15_23_42_/_0.6)]`}
              />
            ))}
          </div>
          {/* Uppe till vänster: favorithjärtat ligger i det högra hörnet. */}
          {/* Fast svart platta, inte `bg-ink`: den vänder med temat och blev ljus
              med vit text i mörkt läge. Överlägg på foton ska se likadana ut i
              båda lägena, för fotot gör det. */}
          <span className="pointer-events-none absolute left-2 top-2 inline-flex h-7 items-center rounded-full bg-black/55 px-2.5 text-[11px] font-medium text-white shadow-soft">
            {index + 1}/{count}
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Lugn platshållare för annonser som förmedlingen publicerat utan bilder.
 * Texten är synlig, så ikonen döljs för skärmläsare i stället för att sidan
 * ska säga samma sak två gånger.
 */
function ImagePlaceholder({ fill }: { fill?: boolean }) {
  const t = useTranslations("listings.card");
  return (
    <div
      className={`relative w-full overflow-hidden bg-linear-to-br from-accent-soft via-canvas to-subtle ${
        fill ? "h-full min-h-28" : "aspect-16/10"
      }`}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <Building2 className="size-9 text-brand-200" strokeWidth={1.5} aria-hidden />
        <span className="text-xs font-medium uppercase tracking-wider text-faint">{t("noImage")}</span>
      </div>
    </div>
  );
}

function NavButton({
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
      onClick={(e) => {
        // Kortet runt omkring är en länk till annonsen.
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={`absolute top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-surface/85 text-ink shadow-soft transition hover:bg-surface focus-visible:opacity-100 sm:opacity-0 sm:group-hover/img:opacity-100 ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      {children}
    </button>
  );
}

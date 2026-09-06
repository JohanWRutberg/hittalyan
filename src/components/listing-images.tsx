"use client";

import { useState } from "react";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Bildspel på annonskortet. Bilderna ligger kvar hos förmedlingen och länkas hit,
 * så vi laddar dem lätt (`loading="lazy"`) och kör medvetet **inte** next/image:
 * Vercels Hobby-plan har en månadskvot för bildoptimeringar som ~1 400 annonser
 * med flera bilder var skulle äta upp i onödan. Bilderna är redan färdigskalade.
 *
 * Ligger utanför kortets <a>, eftersom knappar inte får ligga i en länk.
 */
export function ListingImages({ images, alt }: { images: string[]; alt: string }) {
  const t = useTranslations("listings.card");
  const [index, setIndex] = useState(0);

  // Alla annonser har inte bilder – en del publiceras helt utan. De får en
  // platshållare så att korten blir lika höga och rutnätet inte hackar.
  if (!images.length) return <ImagePlaceholder />;

  const count = images.length;
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);

  return (
    <div className="group/img relative aspect-4/3 w-full overflow-hidden bg-canvas">
      {/* Bara den aktuella bilden ligger i DOM:en; korten kan vara 60 på en sida. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- medvetet: next/image skulle förbruka Vercels kvot för bildoptimeringar på bilder som redan är färdigskalade hos förmedlingen */}
      <img
        src={images[index]}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="size-full object-cover"
        // Trasiga bild-URL:er hos källan ska inte lämna ett brutet ikonkryss.
        onError={(e) => {
          e.currentTarget.style.visibility = "hidden";
        }}
      />

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
                  i === index ? "bg-white" : "bg-white/50"
                } shadow-[0_0_2px_rgb(15_23_42_/_0.6)]`}
              />
            ))}
          </div>
          {/* Uppe till vänster: favorithjärtat ligger i det högra hörnet. */}
          <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-ink/60 px-2 py-0.5 text-[11px] font-medium text-white">
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
function ImagePlaceholder() {
  const t = useTranslations("listings.card");
  return (
    <div className="relative aspect-4/3 w-full overflow-hidden bg-linear-to-br from-brand-50 via-canvas to-slate-100">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <Building2 className="size-9 text-brand-200" strokeWidth={1.5} aria-hidden />
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{t("noImage")}</span>
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
      className={`absolute top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow-soft transition hover:bg-white focus-visible:opacity-100 sm:opacity-0 sm:group-hover/img:opacity-100 ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      {children}
    </button>
  );
}

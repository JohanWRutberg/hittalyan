"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Building2, DoorOpen, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMediaQuery } from "@/lib/use-media-query";
import type { Listing } from "@/generated/prisma/client";
import { formatDate, formatNumber, formatVaning, formatYta, isRecent } from "@/lib/format";
import { ChanceMeter } from "@/components/chance-meter";
import { ListingImages } from "@/components/listing-images";
import { FavoriteButton } from "@/components/favorite-button";
import { useHoveredListing } from "@/components/hovered-listing";
import type { Locale } from "@/i18n/config";
import { marketInfo, marketOf } from "@/lib/markets";

type ListingLike = Omit<Listing, "annonseradFran" | "annonseradTill" | "firstSeenAt" | "lastSeenAt"> & {
  annonseradFran: Date | string | null;
  annonseradTill: Date | string | null;
  firstSeenAt: Date | string;
};

export function ListingCard({
  listing: l,
  index = 0,
  userYears = null,
  showChance = true,
  favorited,
}: {
  listing: ListingLike;
  index?: number;
  userYears?: number | null;
  showChance?: boolean;
  /** Undefined när favoriter inte är tillgängliga (utloggad eller utan Pro) */
  favorited?: boolean;
}) {
  const t = useTranslations("listings");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const market = marketOf(l.market);
  const info = marketInfo(market);
  // Momentum-plattformen (Syd, Uppsala) lämnar inte ut våningsplan, men anger
  // antal sökande. Där tar sökandena våningens plats bland nyckeltalen.
  const showsChance = info.chance !== "applicants";
  const { setHovered, armedId, setArmedId } = useHoveredListing();
  // Pekskärm utan hover: första trycket visar huset på kartan, andra öppnar annonsen.
  // iOS simulerar mouseenter vid tryck, så på sådana enheter ignoreras hover-händelserna helt.
  const noHover = useMediaQuery("(hover: none)");
  const armed = armedId === l.id;
  const isNew = isRecent(l.firstSeenAt);
  const tagKeys = [
    l.nyproduktion && { key: "nyproduktion", cls: "border-amber-200 bg-amber-50 text-amber-700" },
    l.ungdom && { key: "ungdom", cls: "" },
    l.student && { key: "student", cls: "" },
    l.senior && { key: "senior", cls: "" },
    l.korttid && { key: "korttid", cls: "" },
    l.bostadssnabben && info.quickLetTagKey && { key: info.quickLetTagKey, cls: "border-sky-200 bg-sky-50 text-sky-700" },
    l.balkong && { key: "balkong", cls: "" },
    l.hiss && { key: "hiss", cls: "" },
  ].filter(Boolean) as { key: string; cls: string }[];

  const images = l.images ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 12) * 0.03, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      // Hovern ligger på hela kortet, inte bara länken, så att bildspelet också
      // markerar huset på kartan.
      onMouseEnter={noHover ? undefined : () => setHovered(l.id)}
      onMouseLeave={noHover ? undefined : () => setHovered(null)}
      className={`card group relative flex flex-col overflow-hidden transition hover:shadow-lift ${armed ? "ring-2 ring-blue-500/60" : ""}`}
    >
      {/* Bildspel och hjärta ligger utanför länken: en knapp får inte ligga i en <a>. */}
      <ListingImages images={images} alt={`${l.gatuadress}, ${l.stadsdel}`} />
      {favorited !== undefined && (
        <div className="absolute right-3 top-3 z-10">
          <FavoriteButton listingId={l.id} initial={favorited} />
        </div>
      )}

    <a
      href={l.url}
      target="_blank"
      rel="noreferrer"
      onFocus={noHover ? undefined : () => setHovered(l.id)}
      onBlur={noHover ? undefined : () => setHovered(null)}
      onClick={(e) => {
        if (!noHover) return;
        // Första trycket på det här kortet: markera på kartan i stället för att öppna
        if (!armed) {
          e.preventDefault();
          setHovered(l.id);
          setArmedId(l.id);
          return;
        }
        // Andra trycket: öppna annonsen och nollställ
        setArmedId(null);
      }}
      aria-describedby={armed ? `tap-${l.id}` : undefined}
      className="flex flex-1 flex-col gap-3 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {isNew && (
              <span className="chip border-brand-200 bg-brand-50 text-brand-700">
                <Sparkles className="size-3" /> {t("card.new")}
              </span>
            )}
            <span className="text-xs font-medium text-muted">
              {l.stadsdel} · {l.kommun}
            </span>
          </div>
          <h3 className="mt-1 truncate text-lg font-semibold tracking-tight text-ink group-hover:text-brand-700">{l.gatuadress}</h3>
        </div>
        <ArrowUpRight className="size-5 shrink-0 text-slate-300 transition group-hover:text-brand-600" />
      </div>

      <dl className="grid grid-cols-4 gap-2 text-sm">
        <Stat label={t("card.rooms")} value={l.antalRum == null ? "–" : formatNumber(l.antalRum, locale)} />
        <Stat label={t("card.area")} value={formatYta(l.yta)} />
        <Stat label={t("card.rentKr")} value={l.hyra == null ? "–" : formatNumber(l.hyra, locale)} />
        {info.hasFloor ? (
          <Stat label={t("card.floor")} value={formatVaning(l.vaning, locale).replace(/^\D+\s/, "")} />
        ) : (
          <Stat label={t("card.applicantsShort")} value={l.sokande == null ? "–" : formatNumber(l.sokande, locale)} />
        )}
      </dl>

      {tagKeys.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tagKeys.map((tag) => (
            <span key={tag.key} className={`chip ${tag.cls}`}>
              {t(`tags.${tag.key}`)}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto space-y-2.5 border-t border-line pt-3">
        {showsChance &&
          (showChance ? (
            <div className="space-y-1.5">
              <ChanceMeter userYears={userYears} listing={l} />
              {l.sokande != null && <p className="text-xs text-muted">{t("card.applicants", { count: l.sokande })}</p>}
            </div>
          ) : (
            <p className="text-xs text-muted">
              <span className="font-medium text-brand-700">{tc("login")}</span> {t("card.loginForChance")}
              {l.kotidQ1 != null && l.kotidQ3 != null && t("card.similarRequired", { q1: l.kotidQ1, q3: l.kotidQ3 })}
            </p>
          ))}
        {armed && (
          <p id={`tap-${l.id}`} className="rounded-lg bg-blue-50 px-2 py-1 text-center text-[11px] font-medium text-blue-700 sm:hidden">
            {t("card.tapAgain")}
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <DoorOpen className="size-3.5" /> {t("card.lastDay", { date: formatDate(l.annonseradTill, locale) })}
          </span>
          <span className="inline-flex items-center gap-1">
            <Building2 className="size-3.5" /> {l.koNamn ?? l.hyresvard ?? info.name}
          </span>
        </div>
      </div>
    </a>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-canvas px-2 py-2 sm:px-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 whitespace-nowrap font-semibold text-ink">{value}</dd>
    </div>
  );
}

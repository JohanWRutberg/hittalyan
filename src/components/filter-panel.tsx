"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal, X, BellPlus, Search } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { AreaMap, Filters } from "@/lib/filters";
import type { AreaCounts } from "@/lib/areas";
import { filtersToQuery, parseFilters } from "@/lib/filters";
import { FilterFields, Check } from "@/components/filter-fields";
import { useIsDesktop } from "@/lib/use-media-query";
import type { Market } from "@/lib/markets";
import { useStickyPanel } from "@/components/sticky-panel";
import { CollapseToggle } from "@/components/collapse-toggle";

export function FilterPanel({
  areas,
  filters,
  activeCount,
  counts,
  market,
}: {
  areas: AreaMap;
  filters: Filters;
  activeCount: number;
  counts?: AreaCounts;
  market: Market;
}) {
  const t = useTranslations("filters");
  const router = useRouter();
  // Uppe i toppen är filtret en del av den fastnaglade panelen: kompaktare, raka
  // hörn nedåt där kartan tar vid, och en utfälld panel som inte får svälja skärmen.
  const pinned = useStickyPanel();
  const isDesktop = useIsDesktop();
  // Öppen som standard bara på desktop när filter är aktiva; på mobil skulle
  // panelen annars trycka ner kartan och resultaten en hel skärm.
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const open = openOverride ?? (activeCount > 0 && isDesktop);
  const setOpen = setOpenOverride;
  const [pending, start] = useTransition();
  const query = filtersToQuery(filters);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = parseFilters(new FormData(e.currentTarget));
    const q = new URLSearchParams(filtersToQuery(f));
    const cur = new URLSearchParams(window.location.search);
    if (cur.get("sort")) q.set("sort", cur.get("sort")!);
    start(() => router.push(`/lagenheter?${q}`));
  }

  return (
    <div
      className="card overflow-hidden transition-[border-radius] duration-200 ease-out motion-reduce:transition-none"
      style={pinned ? { borderRadius: 0 } : undefined}
    >
      {/* Tre spalter, så pilen hamnar mitt i fältet oavsett hur breda sidorna är. */}
      <div
        className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 transition-[padding] duration-200 ease-out motion-reduce:transition-none ${
          pinned ? "px-3 py-1.5" : "px-5 py-3"
        }`}
      >
        <button type="button" onClick={() => setOpen(!open)} className="flex min-w-0 items-center gap-2 justify-self-start text-sm font-semibold" aria-expanded={open}>
          <SlidersHorizontal className="size-4 shrink-0 text-accent" />
          <span className="truncate">{t("title")}</span>
          {activeCount > 0 && <span className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-xs text-white">{activeCount}</span>}
        </button>
        <CollapseToggle expanded={open} onToggle={() => setOpen(!open)} label={open ? t("hide") : t("show")} compact={pinned} />
        <div className="flex items-center gap-2 justify-self-end">
          {activeCount > 0 && (
            <Link href="/lagenheter" className="btn-ghost px-2 py-1.5 text-xs sm:px-2.5">
              <X className="size-3.5" /> <span className="hidden sm:inline">{t("clear")}</span>
            </Link>
          )}
          <Link href={`/bevakningar/ny?${query}`} className="btn-secondary px-3 py-1.5 text-xs">
            <BellPlus className="size-3.5" /> <span className="sm:hidden">{t("watchThisShort")}</span><span className="hidden sm:inline">{t("watchThis")}</span>
          </Link>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            key="form"
            onSubmit={onSubmit}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-line"
          >
            {/* Fastnaglad och utfälld får panelen aldrig svälja skärmen. */}
            <div className={`space-y-5 p-5 ${pinned ? "max-h-[50vh] overflow-y-auto" : ""}`}>
              <FilterFields areas={areas} initial={filters} counts={counts} market={market} />
              <Check name="nya" label={t("onlyNew")} checked={filters.nya} />
              <div className="flex justify-end gap-2">
                <button type="submit" disabled={pending} className="btn-primary">
                  <Search className="size-4" /> {pending ? t("submitting") : t("submit")}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SlidersHorizontal, X, BellPlus, Search } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { AreaMap, Filters } from "@/lib/filters";
import { filtersToQuery, parseFilters } from "@/lib/filters";
import { FilterFields, Check } from "@/components/filter-fields";

export function FilterPanel({ areas, filters, activeCount }: { areas: AreaMap; filters: Filters; activeCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(activeCount > 0);
  const [pending, start] = useTransition();
  const query = filtersToQuery(filters);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = parseFilters(new FormData(e.currentTarget));
    const q = new URLSearchParams(filtersToQuery(f));
    const cur = new URLSearchParams(window.location.search);
    for (const k of ["sort", "dir"]) if (cur.get(k)) q.set(k, cur.get(k)!);
    start(() => router.push(`/app?${q}`));
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="size-4 text-brand-600" />
          Filter
          {activeCount > 0 && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs text-white">{activeCount}</span>}
        </button>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <Link href="/app" className="btn-ghost px-2.5 py-1.5 text-xs">
              <X className="size-3.5" /> Rensa
            </Link>
          )}
          <Link href={`/app/bevakningar/ny?${query}`} className="btn-secondary px-3 py-1.5 text-xs">
            <BellPlus className="size-3.5" /> Bevaka detta filter
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
            <div className="space-y-5 p-5">
              <FilterFields areas={areas} initial={filters} />
              <Check name="nya" label="Visa bara nya (senaste 24 h)" checked={filters.nya} />
              <div className="flex justify-end gap-2">
                <button type="submit" disabled={pending} className="btn-primary">
                  <Search className="size-4" /> {pending ? "Söker…" : "Visa lägenheter"}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SearchParams } from "@/lib/filters";
import { SORT_OPTIONS, withSort, type Sort } from "@/lib/sort";

/**
 * Sorteringsrad med piller. Klick på inaktivt piller väljer det med standardriktning,
 * klick på aktivt piller vänder riktningen. Ren länk-navigation, inget klientskript.
 */
export function SortBar({ sort, sp }: { sort: Sort; sp: SearchParams }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        <ArrowUpDown className="size-3.5" /> Sortera
      </span>
      {SORT_OPTIONS.map((o) => {
        const active = o.key === sort.key;
        const nextDir = active ? (sort.dir === "asc" ? "desc" : "asc") : o.defaultDir;
        const href = `/app?${withSort(sp, { key: o.key, dir: nextDir })}`;
        const Icon = sort.dir === "asc" ? ArrowUp : ArrowDown;
        return (
          <Link
            key={o.key}
            href={href}
            scroll={false}
            title={active ? `Byt till: ${o[nextDir]}` : o[o.defaultDir]}
            className={`chip py-1.5 transition ${
              active ? "border-brand-300 bg-brand-50 text-brand-800 shadow-soft" : "hover:border-brand-300 hover:text-ink"
            }`}
          >
            {o.label}
            {active && (
              <>
                <Icon className="size-3.5" />
                <span className="font-normal text-brand-700/80">{o[sort.dir]}</span>
              </>
            )}
          </Link>
        );
      })}
    </div>
  );
}

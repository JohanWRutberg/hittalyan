import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, RotateCcw, X } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { SearchParams } from "@/lib/filters";
import { DEFAULT_SORTS, SORT_OPTIONS, isDefaultSorts, withSorts, type Sort } from "@/lib/sort";

/**
 * Sorteringsrad med flera nivåer. Klick på inaktivt piller lägger till det som
 * nästa nivå, klick på aktivt piller vänder riktningen, × tar bort nivån.
 */
export async function SortBar({ sorts, sp }: { sorts: Sort[]; sp: SearchParams }) {
  const t = await getTranslations("sort");
  const explicit = isDefaultSorts(sorts) ? [] : sorts;
  const display = explicit.length ? explicit : DEFAULT_SORTS;
  const multi = display.length > 1;

  return (
    <div className="space-y-1.5">
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
        <span className="mr-1 inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <ArrowUpDown className="size-3.5" /> {t("label")}
        </span>
        {SORT_OPTIONS.map((o) => {
          const idx = display.findIndex((s) => s.key === o.key);
          const active = idx >= 0;
          const current = active ? display[idx] : null;
          const removable = explicit.some((s) => s.key === o.key);
          const nextDir = current ? (current.dir === "asc" ? "desc" : "asc") : o.defaultDir;
          const toggled = active
            ? display.map((s) => (s.key === o.key ? { key: s.key, dir: nextDir } : s))
            : [...explicit, { key: o.key, dir: nextDir }];
          const removed = explicit.filter((s) => s.key !== o.key);
          const Icon = current?.dir === "asc" ? ArrowUp : ArrowDown;
          const label = t(`options.${o.key}.label`);

          return (
            <span
              key={o.key}
              className={`chip shrink-0 gap-0 whitespace-nowrap p-0 transition ${
                active ? "border-brand-300 bg-brand-50 text-brand-800 shadow-soft" : "hover:border-brand-300 hover:text-ink"
              }`}
            >
              <Link
                href={`/app?${withSorts(sp, toggled)}`}
                scroll={false}
                title={active ? t("switchTo", { dir: t(`options.${o.key}.${nextDir}`) }) : t("add", { dir: t(`options.${o.key}.${o.defaultDir}`) })}
                className="inline-flex items-center gap-1 py-1.5 pl-2.5 pr-2.5"
              >
                {active && multi && (
                  <span className="grid size-4 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">{idx + 1}</span>
                )}
                {label}
                {current && (
                  <>
                    <Icon className="size-3.5" />
                    <span className="font-normal text-brand-700/80">{t(`options.${o.key}.${current.dir}`)}</span>
                  </>
                )}
              </Link>
              {removable && (
                <Link
                  href={`/app?${withSorts(sp, removed)}`}
                  scroll={false}
                  title={t("removeLevel")}
                  aria-label={t("removeAria", { label })}
                  className="-ml-1 inline-flex items-center border-l border-brand-200 py-1.5 pl-1.5 pr-2 text-brand-700/70 hover:text-brand-900"
                >
                  <X className="size-3" />
                </Link>
              )}
            </span>
          );
        })}
        {explicit.length > 0 && (
          <Link href={`/app?${withSorts(sp, [])}`} scroll={false} className="btn-ghost shrink-0 px-2.5 py-1.5 text-xs">
            <RotateCcw className="size-3.5" /> {t("reset")}
          </Link>
        )}
      </div>
      {multi && (
        <p className="text-xs text-muted">
          {t("order", {
            list: display.map((s, i) => `${i + 1}. ${t(`options.${s.key}.${s.dir}`).toLowerCase()} (${t(`options.${s.key}.label`).toLowerCase()})`).join(", "),
          })}
        </p>
      )}
    </div>
  );
}

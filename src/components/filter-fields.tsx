"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { AreaMap, Filters } from "@/lib/filters";
import type { AreaCounts } from "@/lib/areas";

/**
 * Gemensamma filterfält för lägenhetslistan och bevakningsformuläret.
 * Renderas inuti ett <form>; fältens namn matchar filterSchema.
 */
export function FilterFields({
  areas,
  initial,
  compact,
  counts,
}: {
  areas: AreaMap;
  initial: Partial<Filters>;
  compact?: boolean;
  /** Antal annonser per område med övriga filter applicerade. Utan counts visas inga siffror. */
  counts?: AreaCounts;
}) {
  const t = useTranslations("filters");
  const [kommuner, setKommuner] = useState<string[]>(initial.kommuner ?? []);
  const [stadsdelar, setStadsdelar] = useState<string[]>(initial.stadsdelar ?? []);

  // Stadsdelar: alla i valda kommuner. Utan vald kommun bara de som har annonser
  // (hela registret är ~1 000 namn), eller alla om vi saknar antal.
  const stadsdelOptions = useMemo(() => {
    const src = kommuner.length ? kommuner : Object.keys(areas);
    const opts: { name: string; count: number }[] = [];
    const seen = new Set<string>();
    for (const k of src) {
      for (const s of areas[k] ?? []) {
        const count = counts?.stadsdel[`${k}|${s}`] ?? 0;
        if (!kommuner.length && counts && count === 0) continue;
        if (seen.has(s)) {
          const existing = opts.find((o) => o.name === s);
          if (existing) existing.count += count;
          continue;
        }
        seen.add(s);
        opts.push({ name: s, count });
      }
    }
    return opts.sort((a, b) => a.name.localeCompare(b.name, "sv"));
  }, [areas, kommuner, counts]);

  const kommunOptions = useMemo(
    () => Object.keys(areas).map((k) => ({ name: k, count: counts?.kommun[k] ?? 0 })),
    [areas, counts],
  );

  function toggle(list: string[], v: string) {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  return (
    <div className="space-y-5">
      <input type="hidden" name="kommuner" value={kommuner.join(",")} />
      <input type="hidden" name="stadsdelar" value={stadsdelar.join(",")} />

      <fieldset>
        <legend className="label">{t("kommun")}</legend>
        <ChipPicker
          options={kommunOptions}
          showCounts={!!counts}
          selected={kommuner}
          onToggle={(v) => {
            const next = toggle(kommuner, v);
            setKommuner(next);
            if (next.length) setStadsdelar(stadsdelar.filter((s) => next.some((k) => areas[k]?.includes(s))));
          }}
          placeholder={t("allKommuner")}
        />
      </fieldset>

      <fieldset>
        <legend className="label">{t("area")}</legend>
        <ChipPicker
          options={stadsdelOptions}
          showCounts={!!counts}
          selected={stadsdelar}
          onToggle={(v) => setStadsdelar(toggle(stadsdelar, v))}
          placeholder={kommuner.length ? t("areaAllSelected") : counts ? t("areaWithListings") : t("areaPickKommun")}
          searchable
        />
      </fieldset>

      <div>
        <label className="label" htmlFor="adress">{t("addressLabel")}</label>
        <input id="adress" name="adress" defaultValue={initial.adress ?? ""} placeholder={t("addressPlaceholder")} className="input" />
        <p className="mt-1 text-xs text-muted">{t("addressHelp")}</p>
      </div>

      <div className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        <Range label={t("rooms")} name="Rum" min={initial.minRum} max={initial.maxRum} step="0.5" />
        <Range label={t("areaM2")} name="Yta" min={initial.minYta} max={initial.maxYta} />
        <Range label={t("rentPerMonth")} name="Hyra" min={initial.minHyra} max={initial.maxHyra} step="100" />
        <Range label={t("floor")} name="Vaning" min={initial.minVaning} max={initial.maxVaning} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Check name="balkong" label={t("balcony")} checked={initial.balkong} />
        <Check name="hiss" label={t("elevator")} checked={initial.hiss} />
        <Check name="nyproduktion" label={t("newBuildOnly")} checked={initial.nyproduktion} />
      </div>

      <details className="rounded-xl border border-line bg-canvas p-3">
        <summary className="cursor-pointer text-sm font-medium text-muted">{t("specialQueues")}</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Check name="inkluderaUngdom" label={t("includeYouth")} checked={initial.inkluderaUngdom} />
          <Check name="inkluderaStudent" label={t("includeStudent")} checked={initial.inkluderaStudent} />
          <Check name="inkluderaSenior" label={t("includeSenior")} checked={initial.inkluderaSenior} />
          <Check name="inkluderaKorttid" label={t("includeShortTerm")} checked={initial.inkluderaKorttid} />
        </div>
      </details>
    </div>
  );
}

function ChipPicker({
  options,
  selected,
  onToggle,
  placeholder,
  searchable,
  showCounts,
}: {
  options: { name: string; count: number }[];
  selected: string[];
  onToggle: (v: string) => void;
  placeholder: string;
  searchable?: boolean;
  showCounts?: boolean;
}) {
  const t = useTranslations("filters");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(selected.length > 0);
  const visible = options.filter((o) => !q || o.name.toLocaleLowerCase("sv").includes(q.toLocaleLowerCase("sv")));
  const countOf = (name: string) => options.find((o) => o.name === name)?.count ?? 0;

  return (
    <div className="rounded-xl border border-line bg-white p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((s) => (
          <button key={s} type="button" onClick={() => onToggle(s)} className="chip border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100">
            {s}
            {showCounts && <CountBadge n={countOf(s)} active />}
            <span aria-hidden>×</span>
          </button>
        ))}
        <button type="button" onClick={() => setOpen(!open)} className="chip hover:border-brand-300">
          {selected.length ? (open ? t("closePicker") : t("change")) : placeholder}
        </button>
      </div>
      {open && (
        <div className="mt-2 border-t border-line pt-2">
          {searchable && (
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="input mb-2 py-1.5" />
          )}
          <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
            {visible.length === 0 && <span className="px-1 text-xs text-muted">{t("noResults")}</span>}
            {visible.map((o) => {
              const on = selected.includes(o.name);
              const empty = showCounts && o.count === 0;
              return (
                <button
                  key={o.name}
                  type="button"
                  onClick={() => onToggle(o.name)}
                  className={`chip transition ${
                    on ? "border-brand-300 bg-brand-100 text-brand-800" : empty ? "text-slate-400 hover:border-slate-300" : "hover:border-brand-300 hover:text-ink"
                  }`}
                >
                  {o.name}
                  {showCounts && <CountBadge n={o.count} active={on} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CountBadge({ n, active }: { n: number; active?: boolean }) {
  return (
    <span
      className={`ml-0.5 rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
        active ? "bg-brand-600 text-white" : n > 0 ? "bg-slate-100 text-slate-600" : "bg-slate-50 text-slate-300"
      }`}
    >
      {n}
    </span>
  );
}

function Range({ label, name, min, max, step }: { label: string; name: string; min?: number; max?: number; step?: string }) {
  const t = useTranslations("filters");
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-1.5">
        <input type="number" name={`min${name}`} defaultValue={min ?? ""} placeholder={t("min")} step={step} inputMode="decimal" className="input px-2.5 py-2" />
        <span className="text-muted">–</span>
        <input type="number" name={`max${name}`} defaultValue={max ?? ""} placeholder={t("max")} step={step} inputMode="decimal" className="input px-2.5 py-2" />
      </div>
    </div>
  );
}

export function Check({ name, label, checked, description }: { name: string; label: string; checked?: boolean; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-white px-3 py-2.5 text-sm transition has-checked:border-brand-300 has-checked:bg-brand-50">
      <input type="checkbox" name={name} defaultChecked={!!checked} className="mt-0.5 size-4 accent-brand-600" />
      <span>
        <span className="font-medium">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
    </label>
  );
}

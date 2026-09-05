"use client";

import { useMemo, useState } from "react";
import type { AreaMap, Filters } from "@/lib/filters";

/**
 * Gemensamma filterfält för lägenhetslistan och bevakningsformuläret.
 * Renderas inuti ett <form>; fältens namn matchar filterSchema.
 */
export function FilterFields({ areas, initial, compact }: { areas: AreaMap; initial: Partial<Filters>; compact?: boolean }) {
  const [kommuner, setKommuner] = useState<string[]>(initial.kommuner ?? []);
  const [stadsdelar, setStadsdelar] = useState<string[]>(initial.stadsdelar ?? []);

  const stadsdelOptions = useMemo(() => {
    const src = kommuner.length ? kommuner : Object.keys(areas);
    const set = new Set<string>();
    for (const k of src) for (const s of areas[k] ?? []) set.add(s);
    return [...set].sort((a, b) => a.localeCompare(b, "sv"));
  }, [areas, kommuner]);

  function toggle(list: string[], v: string) {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  return (
    <div className="space-y-5">
      <input type="hidden" name="kommuner" value={kommuner.join(",")} />
      <input type="hidden" name="stadsdelar" value={stadsdelar.join(",")} />

      <fieldset>
        <legend className="label">Kommun</legend>
        <ChipPicker
          options={Object.keys(areas)}
          selected={kommuner}
          onToggle={(v) => {
            const next = toggle(kommuner, v);
            setKommuner(next);
            if (next.length) setStadsdelar(stadsdelar.filter((s) => next.some((k) => areas[k]?.includes(s))));
          }}
          placeholder="Alla kommuner"
        />
      </fieldset>

      <fieldset>
        <legend className="label">Område / stadsdel</legend>
        <ChipPicker
          options={stadsdelOptions}
          selected={stadsdelar}
          onToggle={(v) => setStadsdelar(toggle(stadsdelar, v))}
          placeholder={kommuner.length ? "Alla områden i valda kommuner" : "Välj gärna kommun först"}
          searchable
        />
      </fieldset>

      <div>
        <label className="label" htmlFor="adress">Adress eller hus</label>
        <input id="adress" name="adress" defaultValue={initial.adress ?? ""} placeholder="t.ex. Nya gatan, Värmdövägen 169, Nackabacken" className="input" />
        <p className="mt-1 text-xs text-muted">Matchar del av gatuadress, stadsdel eller kommun. Flera adresser separeras med komma, då räcker det att en matchar.</p>
      </div>

      <div className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        <Range label="Rum" name="Rum" min={initial.minRum} max={initial.maxRum} step="0.5" />
        <Range label="Yta (m²)" name="Yta" min={initial.minYta} max={initial.maxYta} />
        <Range label="Hyra (kr/mån)" name="Hyra" min={initial.minHyra} max={initial.maxHyra} step="100" />
        <Range label="Våning" name="Vaning" min={initial.minVaning} max={initial.maxVaning} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Check name="balkong" label="Balkong" checked={initial.balkong} />
        <Check name="hiss" label="Hiss" checked={initial.hiss} />
        <Check name="nyproduktion" label="Endast nyproduktion" checked={initial.nyproduktion} />
      </div>

      <details className="rounded-xl border border-line bg-canvas p-3">
        <summary className="cursor-pointer text-sm font-medium text-muted">Specialköer (uteslutna som standard)</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Check name="inkluderaUngdom" label="Inkludera ungdomslägenheter" checked={initial.inkluderaUngdom} />
          <Check name="inkluderaStudent" label="Inkludera studentlägenheter" checked={initial.inkluderaStudent} />
          <Check name="inkluderaSenior" label="Inkludera seniorlägenheter" checked={initial.inkluderaSenior} />
          <Check name="inkluderaKorttid" label="Inkludera korttidskontrakt" checked={initial.inkluderaKorttid} />
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
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  placeholder: string;
  searchable?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(selected.length > 0);
  const visible = options.filter((o) => !q || o.toLocaleLowerCase("sv").includes(q.toLocaleLowerCase("sv")));

  return (
    <div className="rounded-xl border border-line bg-white p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((s) => (
          <button key={s} type="button" onClick={() => onToggle(s)} className="chip border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100">
            {s} <span aria-hidden>×</span>
          </button>
        ))}
        <button type="button" onClick={() => setOpen(!open)} className="chip hover:border-brand-300">
          {selected.length ? (open ? "Stäng" : "Ändra") : placeholder}
        </button>
      </div>
      {open && (
        <div className="mt-2 border-t border-line pt-2">
          {searchable && (
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök…" className="input mb-2 py-1.5" />
          )}
          <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
            {visible.length === 0 && <span className="px-1 text-xs text-muted">Inga träffar</span>}
            {visible.map((o) => {
              const on = selected.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => onToggle(o)}
                  className={`chip transition ${on ? "border-brand-300 bg-brand-100 text-brand-800" : "hover:border-brand-300 hover:text-ink"}`}
                >
                  {o}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Range({ label, name, min, max, step }: { label: string; name: string; min?: number; max?: number; step?: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-1.5">
        <input type="number" name={`min${name}`} defaultValue={min ?? ""} placeholder="min" step={step} inputMode="decimal" className="input px-2.5 py-2" />
        <span className="text-muted">–</span>
        <input type="number" name={`max${name}`} defaultValue={max ?? ""} placeholder="max" step={step} inputMode="decimal" className="input px-2.5 py-2" />
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

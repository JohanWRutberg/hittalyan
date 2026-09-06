"use client";

import { Check } from "lucide-react";
import { MARKETS, marketInfo, type Market } from "@/lib/markets";

/**
 * Val av bostadsförmedling. Fyra kort, ett per kö. Används både i
 * registreringsformuläret och när man byter kö under Konto.
 */
export function MarketPicker({
  value,
  onSelect,
  disabled,
}: {
  value: Market;
  onSelect?: (market: Market) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {MARKETS.map((m) => {
        const info = marketInfo(m);
        const active = m === value;
        return (
          <button
            key={m}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onSelect?.(m)}
            className={`flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left transition disabled:opacity-60 ${
              active
                ? "border-brand-300 bg-brand-50 shadow-soft"
                : "border-line bg-white hover:border-brand-200 hover:bg-canvas"
            }`}
          >
            <span className="min-w-0">
              <span className={`block font-semibold ${active ? "text-brand-800" : "text-ink"}`}>{info.city}</span>
              <span className="block truncate text-xs text-muted">{info.name}</span>
            </span>
            {active && <Check className="size-4 shrink-0 text-brand-700" />}
          </button>
        );
      })}
    </div>
  );
}

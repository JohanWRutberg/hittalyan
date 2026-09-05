"use client";

import { chanceFor, formatYears } from "@/lib/chance";

/** Skala för mätaren i år. Allt över klipps mot höger kant. */
const SCALE_YEARS = 20;
const pct = (y: number) => `${Math.min(100, Math.max(0, (y / SCALE_YEARS) * 100))}%`;

export function ChanceMeter({
  userYears,
  q1,
  q3,
  compact,
}: {
  userYears: number | null;
  q1: number | null;
  q3: number | null;
  compact?: boolean;
}) {
  const c = chanceFor(userYears, q1, q3);
  const hasRange = q1 != null && q3 != null;

  return (
    <div className="flex items-center gap-2.5" title={
      hasRange
        ? `${c.hint} Liknande lägenheter: ${q1}–${q3} års kötid${userYears != null ? `. Din kötid: ${formatYears(userYears)}` : ""}.`
        : c.hint
    }>
      <span className={`chip shrink-0 ${c.pill}`}>
        <span className={`size-1.5 rounded-full ${c.dot}`} />
        {c.label}
      </span>
      {hasRange && (
        <div className="relative h-1.5 min-w-16 flex-1 rounded-full bg-slate-100">
          <div className="absolute inset-y-0 rounded-full bg-slate-300/80" style={{ left: pct(q1), width: `calc(${pct(q3)} - ${pct(q1)})` }}>
            {/* Tredjedelsmarkeringar: början / mitten / slutet av spannet */}
            <span className="absolute inset-y-0 left-1/3 w-px bg-white/90" />
            <span className="absolute inset-y-0 left-2/3 w-px bg-white/90" />
          </div>
          {userYears != null && (
            <span
              className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm ${c.dot}`}
              style={{ left: pct(userYears) }}
            />
          )}
        </div>
      )}
      {!compact && hasRange && (
        <span className="shrink-0 text-xs text-muted">
          {q1}–{q3} år
        </span>
      )}
    </div>
  );
}

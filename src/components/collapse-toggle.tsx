"use client";

import { ChevronDown } from "lucide-react";

/**
 * Fäll in och ut. Används av både filterpanelen och kartan så att de två fälten
 * har samma affordans: en pil mitt i rubrikraden, nedåt när något är dolt och
 * uppåt när det är utfällt.
 *
 * Pilen roteras i stället för att bytas ut, vilket ger en mjukare övergång och
 * håller knappens bredd konstant.
 */
export function CollapseToggle({
  expanded,
  onToggle,
  label,
  compact,
}: {
  expanded: boolean;
  onToggle: () => void;
  /** Beskriver vad klicket gör, för skärmläsare och verktygstips */
  label: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={label}
      title={label}
      // Hover och tryckyta ligger i globals.css: Tailwinds hover-variant gäller
      // även på pekskärm, där tillståndet annars blir kvar efter ett tryck.
      className={`collapse-toggle inline-flex items-center justify-center rounded-full text-muted transition ${
        compact ? "h-6 w-10" : "h-7 w-12"
      }`}
    >
      <ChevronDown
        className={`size-4 transition-transform duration-200 ease-out motion-reduce:transition-none ${
          expanded ? "rotate-180" : ""
        }`}
      />
    </button>
  );
}

"use client";

import { ChevronDown } from "lucide-react";

/**
 * Fäll in och ut. Används av både filterpanelen och kartan så att de två fälten
 * har samma affordans: en pil mitt i rubrikraden, nedåt när något är dolt och
 * uppåt när det är utfällt.
 *
 * Pilen roteras i stället för att bytas ut, vilket ger en mjukare övergång och
 * håller knappens bredd konstant.
 *
 * Den ser ut som en knapp: kant, accentfärg och en kraftig pil. Förut var den en
 * grå chevron utan kant, och testarna hittade den inte – filtret och kartan såg
 * ut att sakna ett sätt att fällas ihop.
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
      onClick={(e) => {
        // Hela rubrikraden är klickbar; annars skulle klicket räknas två gånger.
        e.stopPropagation();
        onToggle();
      }}
      aria-expanded={expanded}
      aria-label={label}
      title={label}
      // Hover och tryckyta ligger i globals.css: Tailwinds hover-variant gäller
      // även på pekskärm, där tillståndet annars blir kvar efter ett tryck.
      className={`collapse-toggle inline-flex items-center justify-center rounded-full border border-accent-line bg-accent-soft text-accent shadow-soft transition ${
        compact ? "h-7 w-12" : "h-8 w-14"
      }`}
    >
      <ChevronDown
        strokeWidth={2.75}
        className={`transition-transform duration-200 ease-out motion-reduce:transition-none ${compact ? "size-4" : "size-5"} ${
          expanded ? "rotate-180" : ""
        }`}
      />
    </button>
  );
}

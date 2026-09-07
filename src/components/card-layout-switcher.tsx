"use client";

import { useSyncExternalStore } from "react";
import { LayoutGrid, Rows3, Grid2x2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CARD_LAYOUTS,
  cardLayoutServerSnapshot,
  readCardLayout,
  subscribeCardLayout,
  writeCardLayout,
  type CardLayout,
} from "@/lib/card-layout";

const ICONS: Record<CardLayout, typeof LayoutGrid> = {
  comfortable: LayoutGrid,
  compact: Grid2x2,
  list: Rows3,
};

/**
 * Hur annonskorten radas upp. Läser tillståndet själv, så att den kan placeras
 * var som helst – även inuti en serverkomponent som sorteringsraden.
 */
export function CardLayoutSwitcher() {
  const t = useTranslations("listings.layout");
  const value = useSyncExternalStore(subscribeCardLayout, readCardLayout, cardLayoutServerSnapshot);
  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5" role="group" aria-label={t("label")}>
      {CARD_LAYOUTS.map((option) => {
        const Icon = ICONS[option];
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            title={t(option)}
            aria-label={t(option)}
            onClick={() => writeCardLayout(option)}
            className={`inline-flex items-center justify-center rounded-lg p-1.5 transition ${
              active ? "bg-accent-soft text-accent shadow-soft" : "text-muted hover:bg-subtle hover:text-ink"
            }`}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

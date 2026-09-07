/**
 * Hur annonskorten radas upp. Ren webbläsarinställning, samma mönster som
 * `page-size.ts`: sparas i localStorage, skickas aldrig till servern, och läses
 * med useSyncExternalStore så att servern kan rendera standardvärdet utan
 * hydreringsvarning.
 */

export const CARD_LAYOUTS = ["comfortable", "compact", "list"] as const;
export type CardLayout = (typeof CARD_LAYOUTS)[number];

export const DEFAULT_CARD_LAYOUT: CardLayout = "comfortable";

const KEY = "hl_card_layout";
const EVENT = "hl-card-layout-change";

const isLayout = (v: unknown): v is CardLayout =>
  typeof v === "string" && (CARD_LAYOUTS as readonly string[]).includes(v);

/** Tailwind-klasser för rutnätet i respektive läge. */
export const LAYOUT_GRID: Record<CardLayout, string> = {
  comfortable: "grid gap-4 sm:grid-cols-2 xl:grid-cols-3",
  compact: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  list: "flex flex-col gap-3",
};

export function readCardLayout(): CardLayout {
  if (typeof window === "undefined") return DEFAULT_CARD_LAYOUT;
  try {
    const v = window.localStorage.getItem(KEY);
    return isLayout(v) ? v : DEFAULT_CARD_LAYOUT;
  } catch {
    // Privat läge eller blockerad lagring: kör vidare med standardvärdet.
    return DEFAULT_CARD_LAYOUT;
  }
}

export function writeCardLayout(value: CardLayout): void {
  if (!isLayout(value)) return;
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    /* går inte att spara: valet gäller den här sidvisningen */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function subscribeCardLayout(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export const cardLayoutServerSnapshot = (): CardLayout => DEFAULT_CARD_LAYOUT;

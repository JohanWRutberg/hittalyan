/**
 * Hur många annonser som visas per sida. Valet är en ren webbläsarinställning:
 * det sparas i localStorage och skickas aldrig till servern, eftersom hela
 * träfflistan ändå finns i webbläsaren och sidbläddringen sker där.
 *
 * Samma mönster som cookie-samtycket i `consent.ts`: läses med
 * useSyncExternalStore, så att servern renderar standardvärdet och
 * webbläsaren tar över utan hydreringsvarning.
 */

export const PAGE_SIZES = [10, 25, 50, 75, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

const KEY = "hl_page_size";
const EVENT = "hl-page-size-change";

export function readPageSize(): number {
  if (typeof window === "undefined") return DEFAULT_PAGE_SIZE;
  try {
    const n = Number(window.localStorage.getItem(KEY));
    return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
  } catch {
    // Privat läge eller blockerad lagring: kör vidare med standardvärdet.
    return DEFAULT_PAGE_SIZE;
  }
}

export function writePageSize(value: number): void {
  if (!(PAGE_SIZES as readonly number[]).includes(value)) return;
  try {
    window.localStorage.setItem(KEY, String(value));
  } catch {
    /* går inte att spara: valet gäller den här sidvisningen */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function subscribePageSize(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export const pageSizeServerSnapshot = (): number => DEFAULT_PAGE_SIZE;

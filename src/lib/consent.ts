/**
 * Samtycke till statistikcookies.
 *
 * Hitta Lyan sätter tre cookies utan att fråga: inloggningens sessionscookie,
 * språkvalet och vald bostadsförmedling. De är nödvändiga för att tjänsten ska
 * fungera och kräver inget samtycke enligt ePrivacy-direktivet.
 *
 * Google Analytics är något annat: den kräver ett aktivt ja innan den läses in.
 * Därför laddas GA över huvud taget inte förrän användaren sagt ja, och bannern
 * visas bara när NEXT_PUBLIC_GA_ID faktiskt är satt – finns ingen mätning finns
 * inget att samtycka till.
 *
 * Valet sparas i localStorage, inte i en cookie: det behövs bara i webbläsaren
 * och ska inte skickas med varje anrop till servern.
 */

export const CONSENT_KEY = "hl_consent";
export const CONSENT_EVENT = "hl-consent-change";

export type Consent = "granted" | "denied";

export const isConsent = (v: unknown): v is Consent => v === "granted" || v === "denied";

export function readConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return isConsent(v) ? v : null;
  } catch {
    // Privat läge eller blockerad lagring: behandla som att inget valts.
    return null;
  }
}

/** Prenumeration för useSyncExternalStore: egen händelse plus andra flikar. */
export function subscribeConsent(onChange: () => void): () => void {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** På servern finns inget val ännu; bannern avgörs först i webbläsaren. */
export const consentServerSnapshot = (): Consent | null => null;

export function clearConsent(): void {
  try {
    window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* går inte att rensa: händelsen nedan öppnar bannern ändå */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT));
}

export function writeConsent(value: Consent): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* går inte att spara: valet gäller bara den här sidvisningen */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

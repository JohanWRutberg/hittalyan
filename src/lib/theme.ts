/**
 * Utseendeläge. Valet ligger i localStorage och inte i en cookie: det behövs bara
 * i webbläsaren, och tjänsten sätter medvetet så få cookies som möjligt.
 *
 * Att valet inte når servern betyder att första målningen måste sättas av ett
 * litet skript i <head> (se THEME_INIT_SCRIPT), annars blinkar sidan ljus innan
 * React hunnit starta.
 */

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_KEY = "hl_theme";
export const DEFAULT_THEME: Theme = "system";

export const isTheme = (v: unknown): v is Theme => typeof v === "string" && (THEMES as readonly string[]).includes(v);

/** Vad ett val faktiskt blir just nu, med systemets inställning inräknad. */
export function resolveTheme(theme: Theme, prefersDark: boolean): "light" | "dark" {
  if (theme === "system") return prefersDark ? "dark" : "light";
  return theme;
}

/**
 * Körs synkront i <head>, före första målningen. Håll den liten och utan
 * beroenden – den blockerar renderingen tills den är klar.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});var d=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

/** Egen händelse, så att växlingen slår igenom direkt i samma flik. */
export const THEME_EVENT = "hl-theme-change";

export function readTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return isTheme(v) ? v : DEFAULT_THEME;
  } catch {
    // Privat läge eller blockerad lagring: följ systemet.
    return DEFAULT_THEME;
  }
}

export function writeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* går inte att spara: valet gäller ändå den här sessionen */
  }
  window.dispatchEvent(new CustomEvent(THEME_EVENT));
}

/** Prenumeration för useSyncExternalStore: egen händelse plus andra flikar. */
export function subscribeTheme(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** På servern är valet okänt; växlaren markeras först i webbläsaren. */
export const themeServerSnapshot = (): Theme => DEFAULT_THEME;

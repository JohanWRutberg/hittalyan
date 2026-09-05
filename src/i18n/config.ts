export const LOCALES = ["sv", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "sv";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/** BCP 47-tagg för Intl-formatering (datum, tal). */
export const intlTag = (locale: Locale) => (locale === "en" ? "en-GB" : "sv-SE");

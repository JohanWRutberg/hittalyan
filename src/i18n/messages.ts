import { createTranslator } from "next-intl";
import sv from "@/messages/sv.json";
import en from "@/messages/en.json";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

const MESSAGES = { sv, en } as const;

/** Översättare utanför React (mail, push, cron). Använd punktnotation: t("email.lead"). */
export function translatorFor(locale: string | null | undefined) {
  const l: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE;
  return createTranslator({ locale: l, messages: MESSAGES[l] });
}

export const localeOf = (locale: string | null | undefined): Locale => (isLocale(locale) ? locale : DEFAULT_LOCALE);

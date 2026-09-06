"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { clearConsent, consentServerSnapshot, readConsent, subscribeConsent, writeConsent } from "@/lib/consent";

/**
 * Samtyckesbanner. Visas bara när det faktiskt finns statistik att samtycka till
 * (NEXT_PUBLIC_GA_ID satt) och användaren inte redan valt.
 */
export function CookieConsent({ enabled }: { enabled: boolean }) {
  const t = useTranslations("cookies");
  // Valet bor i webbläsaren, inte i React. Sidfotens "Cookieinställningar"
  // nollställer det och öppnar bannern igen, även i en annan flik.
  const consent = useSyncExternalStore(subscribeConsent, readConsent, consentServerSnapshot);
  const open = enabled && consent == null;

  if (!enabled) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-label={t("title")}
          className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-line bg-white p-5 shadow-lift sm:flex-row sm:items-center">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Cookie className="size-5" />
            </span>
            <div className="flex-1 text-sm">
              <p className="font-semibold">{t("title")}</p>
              <p className="mt-0.5 text-muted">
                {t("lead")}{" "}
                <Link href="/ansvarsfriskrivning" className="font-medium text-brand-700 hover:underline">
                  {t("readMore")}
                </Link>
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => writeConsent("denied")} className="btn-secondary flex-1 sm:flex-none">
                {t("deny")}
              </button>
              <button type="button" onClick={() => writeConsent("granted")} className="btn-primary flex-1 sm:flex-none">
                {t("accept")}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Länk i sidfoten som öppnar bannern igen så att valet går att ändra. */
export function CookieSettingsButton({ label }: { label: string }) {
  const consent = useSyncExternalStore(subscribeConsent, readConsent, consentServerSnapshot);
  // Finns inget val att göra om syns ingen länk.
  if (consent == null) return null;

  return (
    <button type="button" onClick={clearConsent} className="hover:text-brand-700">
      {label}
    </button>
  );
}

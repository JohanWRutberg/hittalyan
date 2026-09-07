"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { THEMES, readTheme, resolveTheme, subscribeTheme, themeServerSnapshot, writeTheme, type Theme } from "@/lib/theme";

const ICONS: Record<Theme, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };

/** Applicerar läget på <html>, samma attribut som skriptet i <head> sätter. */
function apply(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = resolveTheme(theme, prefersDark);
}

export function ThemeSwitcher({ compact }: { compact?: boolean }) {
  const t = useTranslations("theme");
  // Servern vet inte vilket läge som gäller. useSyncExternalStore låter React
  // rendera serverns antagande först och rätta direkt vid hydrering, och ger
  // synk mellan flikar på köpet – samma mönster som cookie-samtycket.
  const theme = useSyncExternalStore(subscribeTheme, readTheme, themeServerSnapshot);

  // Följ systemet i realtid så länge användaren inte valt något eget.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  return (
    <div
      className="flex items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5"
      role="group"
      aria-label={t("label")}
    >
      {THEMES.map((option) => {
        const Icon = ICONS[option];
        const active = theme === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            title={t(option)}
            aria-label={t(option)}
            onClick={() => {
              writeTheme(option);
              apply(option);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs font-semibold transition ${
              active ? "bg-accent-soft text-accent shadow-soft" : "text-muted hover:bg-subtle hover:text-ink"
            }`}
          >
            <Icon className="size-3.5" />
            {!compact && <span>{t(option)}</span>}
          </button>
        );
      })}
    </div>
  );
}

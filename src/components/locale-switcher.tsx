"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/lib/locale-actions";
import { LOCALES, type Locale } from "@/i18n/config";

function FlagSE({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 10" className={className} aria-hidden>
      <rect width="16" height="10" fill="#006AA7" />
      <rect x="5" width="2" height="10" fill="#FECC00" />
      <rect y="4" width="16" height="2" fill="#FECC00" />
    </svg>
  );
}

function FlagGB({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden>
      <clipPath id="gb-clip">
        <rect width="60" height="30" />
      </clipPath>
      <g clipPath="url(#gb-clip)">
        <rect width="60" height="30" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="2" />
        <path d="M30,0 V30 M0,15 H60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}

const FLAGS: Record<Locale, { Flag: typeof FlagSE; labelKey: "swedish" | "english" }> = {
  sv: { Flag: FlagSE, labelKey: "swedish" },
  en: { Flag: FlagGB, labelKey: "english" },
};

/** Två flaggor; den aktiva är markerad. Byter cookie + sparar på användaren, sedan omrendering. */
export function LocaleSwitcher({ compact }: { compact?: boolean }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className={`flex items-center gap-0.5 rounded-xl border border-line bg-white p-0.5 ${pending ? "opacity-60" : ""}`} role="group" aria-label={t("language")}>
      {LOCALES.map((l) => {
        const { Flag, labelKey } = FLAGS[l];
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            disabled={pending || active}
            aria-pressed={active}
            title={t(labelKey)}
            onClick={() =>
              start(async () => {
                await setLocale(l);
                router.refresh();
              })
            }
            className={`inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs font-semibold transition ${
              active ? "bg-brand-50 text-brand-800 shadow-soft" : "text-muted hover:bg-slate-100 hover:text-ink"
            }`}
          >
            <Flag className="h-3.5 w-[21px] rounded-[2px] shadow-[0_0_0_1px_rgb(15_23_42_/_0.08)]" />
            {!compact && <span className="uppercase">{l}</span>}
          </button>
        );
      })}
    </div>
  );
}

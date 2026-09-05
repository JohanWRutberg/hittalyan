"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, Smartphone, Monitor, X } from "lucide-react";

type Platform = "ios-safari" | "ios-installed" | "android" | "desktop" | "unknown";

interface GuideState {
  platform: Platform;
  supported: boolean;
  subscribed: boolean;
  permission: NotificationPermission | "unsupported";
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (isIos) return standalone ? "ios-installed" : "ios-safari";
  if (/Android/.test(ua)) return "android";
  if (/Mobi/.test(ua)) return "unknown";
  return "desktop";
}

async function detect(): Promise<GuideState> {
  const platform = detectPlatform();
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  let subscribed = false;
  if (supported) {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      subscribed = !!(await reg?.pushManager.getSubscription());
    } catch {
      subscribed = false;
    }
  }
  return { platform, supported, subscribed, permission: supported ? Notification.permission : "unsupported" };
}

const DISMISS_KEY = "hittalyan:push-banner-dismissed";

/**
 * Plattformsanpassad guide för push-notiser.
 * variant="banner": kompakt, avvisningsbar, visas bara på mobil när notiser inte är aktiva.
 * variant="full": hela guiden för alla plattformar (Konto-sidan).
 */
export function PushGuide({ variant }: { variant: "banner" | "full" }) {
  const t = useTranslations("push.banner");
  const [state, setState] = useState<GuideState | null>(null);
  const [dismissed, setDismissed] = useState(true); // döljs tills vi läst localStorage

  useEffect(() => {
    let cancelled = false;
    detect().then((s) => {
      if (cancelled) return;
      setState(s);
      let d = false;
      try {
        d = localStorage.getItem(DISMISS_KEY) === "1";
      } catch {
        d = false;
      }
      setDismissed(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) return null;

  if (variant === "banner") {
    const mobile = state.platform === "ios-safari" || state.platform === "ios-installed" || state.platform === "android" || state.platform === "unknown";
    if (!mobile || state.subscribed || dismissed) return null;
    const text =
      state.platform === "ios-safari" ? t("ios") : state.platform === "ios-installed" ? t("iosInstalled") : t("android");
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
        <Bell className="mt-0.5 size-4 shrink-0 text-brand-700" />
        <p className="flex-1">
          {text}{" "}
          <Link href="/konto" className="font-semibold underline">
            {t("link")}
          </Link>
        </p>
        <button
          type="button"
          aria-label={t("dismiss")}
          className="-mr-1 -mt-1 rounded-lg p-1 text-brand-700/70 hover:bg-brand-100 hover:text-brand-900"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* ignorera */
            }
          }}
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return <FullGuide state={state} />;
}

function FullGuide({ state }: { state: GuideState }) {
  const t = useTranslations("push.guide");
  const you = state.platform;
  const sections = [
    { id: "ios-safari" as const, key: "ios" as const, icon: Smartphone, steps: 4 },
    { id: "android" as const, key: "android" as const, icon: Smartphone, steps: 3 },
    { id: "desktop" as const, key: "desktop" as const, icon: Monitor, steps: 3 },
  ];
  const current = you === "ios-installed" ? "ios-safari" : you === "unknown" ? "android" : you;

  return (
    <div className="space-y-3">
      {state.platform === "ios-installed" && (
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">{t("installed")}</p>
      )}
      {sections.map((s) => {
        const mine = s.id === current;
        return (
          <details key={s.id} open={mine} className={`rounded-xl border p-3 ${mine ? "border-brand-200 bg-brand-50/40" : "border-line bg-white"}`}>
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <s.icon className="size-4 text-brand-700" />
              {t(`${s.key}.title`)}
              {mine && <span className="chip ml-auto border-brand-200 bg-brand-50 text-brand-700">{t("yourDevice")}</span>}
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink">
              {Array.from({ length: s.steps }, (_, i) => (
                <li key={i}>{t(`${s.key}.steps.${i}`)}</li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-muted">{t(`${s.key}.note`)}</p>
          </details>
        );
      })}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

const DISMISS_KEY = "ledigt:push-banner-dismissed";

/**
 * Plattformsanpassad guide för push-notiser.
 * variant="banner": kompakt, avvisningsbar, visas bara på mobil när notiser inte är aktiva.
 * variant="full": hela guiden för alla plattformar (Konto-sidan).
 */
export function PushGuide({ variant }: { variant: "banner" | "full" }) {
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
      state.platform === "ios-safari"
        ? "På iPhone får du notiser om du lägger Ledigt på hemskärmen: Dela → Lägg till på hemskärmen, öppna därifrån och aktivera under Konto."
        : state.platform === "ios-installed"
          ? "Aktivera notiser under Konto så hör vi av oss direkt när något matchar."
          : "Aktivera notiser under Konto så får du en notis i telefonen när något matchar.";
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
        <Bell className="mt-0.5 size-4 shrink-0 text-brand-700" />
        <p className="flex-1">
          {text}{" "}
          <Link href="/app/konto" className="font-semibold underline">
            Till Konto
          </Link>
        </p>
        <button
          type="button"
          aria-label="Dölj"
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
  const you = state.platform;
  const sections: { id: Platform | "desktop"; icon: typeof Smartphone; title: string; steps: string[]; note?: string }[] = [
    {
      id: "ios-safari",
      icon: Smartphone,
      title: "iPhone och iPad",
      steps: [
        "Öppna Ledigt i Safari och tryck på Dela-knappen (rutan med pilen).",
        "Välj “Lägg till på hemskärmen” och sedan “Lägg till”.",
        "Öppna Ledigt från hemskärmen, gå till Konto och tryck “Aktivera notiser”.",
        "Tillåt notiser när iPhone frågar.",
      ],
      note: "Kräver iOS 16.4 eller senare. Notiser fungerar bara i hemskärmsversionen, inte i vanliga Safari. Får du inga notiser: Inställningar → Notiser → Ledigt.",
    },
    {
      id: "android",
      icon: Smartphone,
      title: "Android",
      steps: [
        "Öppna Ledigt i Chrome, Edge, Samsung Internet eller Firefox.",
        "Gå till Konto och tryck “Aktivera notiser”, tillåt när telefonen frågar.",
        "Valfritt: lägg till på hemskärmen via webbläsarens meny för snabbare åtkomst.",
      ],
      note: "Får du inga notiser: kontrollera Inställningar → Appar → din webbläsare → Notiser, och att batterisparläge inte begränsar webbläsaren.",
    },
    {
      id: "desktop",
      icon: Monitor,
      title: "Dator",
      steps: [
        "Chrome, Edge, Firefox och Safari (macOS 13 eller senare) stöds.",
        "Gå till Konto och klicka “Aktivera notiser”, tillåt i webbläsarens fråga.",
        "Notiserna visas även när fliken är stängd, så länge webbläsaren körs.",
      ],
      note: "På Mac: Systeminställningar → Notiser → din webbläsare måste vara tillåten. På Windows: Inställningar → System → Aviseringar.",
    },
  ];

  const current = you === "ios-installed" ? "ios-safari" : you === "unknown" ? "android" : you;

  return (
    <div className="space-y-3">
      {state.platform === "ios-installed" && (
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">Ledigt är installerat på hemskärmen. Tryck på knappen ovan för att aktivera notiser.</p>
      )}
      {sections.map((s) => {
        const mine = s.id === current;
        return (
          <details key={s.id} open={mine} className={`rounded-xl border p-3 ${mine ? "border-brand-200 bg-brand-50/40" : "border-line bg-white"}`}>
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <s.icon className="size-4 text-brand-700" />
              {s.title}
              {mine && <span className="chip ml-auto border-brand-200 bg-brand-50 text-brand-700">Din enhet</span>}
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink">
              {s.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {s.note && <p className="mt-2 text-xs text-muted">{s.note}</p>}
          </details>
        );
      })}
    </div>
  );
}

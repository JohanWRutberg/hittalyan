"use client";

import Script from "next/script";
import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { consentServerSnapshot, readConsent, subscribeConsent } from "@/lib/consent";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Google Analytics, som laddas **först efter samtycke**. Ingen skripttagg och
 * inga cookies innan dess. Saknas NEXT_PUBLIC_GA_ID händer ingenting alls, vilket
 * gör att sajten kan köras utan mätning tills kontot är på plats.
 */
export function Analytics({ gaId }: { gaId?: string }) {
  const consent = useSyncExternalStore(subscribeConsent, readConsent, consentServerSnapshot);
  const granted = consent === "granted";
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // App Router byter sida utan omladdning, så sidvisningar måste skickas manuellt.
  useEffect(() => {
    if (!gaId || !granted || typeof window.gtag !== "function") return;
    const query = searchParams.toString();
    window.gtag("event", "page_view", { page_path: pathname + (query ? `?${query}` : "") });
  }, [gaId, granted, pathname, searchParams]);

  if (!gaId || !granted) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          // Sidvisningar skickas från komponenten i stället, så att de följer
          // med vid navigering utan omladdning.
          gtag('config', '${gaId}', { send_page_view: false, anonymize_ip: true });
        `}
      </Script>
    </>
  );
}

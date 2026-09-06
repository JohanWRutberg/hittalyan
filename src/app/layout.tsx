import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Analytics } from "@/components/analytics";
import { CookieConsent } from "@/components/cookie-consent";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: { default: t("title"), template: t("template") },
    description: t("description"),
    applicationName: "Hitta Lyan",
    appleWebApp: { capable: true, title: "Hitta Lyan", statusBarStyle: "default" },
    icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  };
}

export const viewport: Viewport = {
  themeColor: "#157e6c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  // Utan mät-id finns inga icke-nödvändiga cookies, och därmed inget att fråga om.
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          {children}
          <CookieConsent enabled={!!gaId} />
          {/* useSearchParams kräver en Suspense-gräns för att sidorna ska kunna renderas statiskt. */}
          <Suspense fallback={null}>
            <Analytics gaId={gaId} />
          </Suspense>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

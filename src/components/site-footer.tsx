import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MARKETS, marketInfo } from "@/lib/markets";
import { getSession } from "@/lib/session";
import { CookieSettingsButton } from "@/components/cookie-consent";

/** Sidfot med navigering, förmedlingarna vi bevakar och det juridiska. */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  const tn = await getTranslations("nav");
  const session = await getSession();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-line bg-white">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-bold tracking-tight">Hitta Lyan</p>
          <p className="mt-2 max-w-sm text-sm text-muted">{t("tagline")}</p>
        </div>

        <nav>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t("service")}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/lagenheter" className="hover:text-brand-700">{tn("listings")}</Link>
            </li>
            <li>
              <Link href="/pro" className="hover:text-brand-700">{tn("pro")}</Link>
            </li>
            {/* Kontaktformuläret kräver inloggning, så utloggade skickas till inloggningen. */}
            <li>
              <Link href={session ? "/kontakt" : "/login"} className="hover:text-brand-700">{t("contact")}</Link>
            </li>
          </ul>
        </nav>

        <nav>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t("about")}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/om-oss" className="hover:text-brand-700">{t("aboutUs")}</Link>
            </li>
            <li>
              <Link href="/ansvarsfriskrivning" className="hover:text-brand-700">{t("disclaimer")}</Link>
            </li>
            <li>
              <CookieSettingsButton label={t("cookieSettings")} />
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto w-full max-w-7xl space-y-2 px-4 py-6 text-xs text-muted sm:px-6">
          <p>{t("sources", { list: MARKETS.map((m) => marketInfo(m).name).join(" · ") })}</p>
          <p>
            © {year} Hitta Lyan. {t("independent")}
          </p>
        </div>
      </div>
    </footer>
  );
}

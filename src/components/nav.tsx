import Link from "next/link";
import { LogIn } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { NavLinks, SignOutButton } from "@/components/nav-client";
import { AutoHideHeader } from "@/components/auto-hide-header";

/** Meny för utloggade besökare i det öppna listläget. */
export async function PublicNav() {
  const t = await getTranslations("common");
  return (
    <AutoHideHeader>
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6">
        <Logo href="/" />
        <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeSwitcher compact />
          <LocaleSwitcher compact />
          <Link href="/login" title={t("login")} aria-label={t("login")} className="btn-ghost px-2 sm:px-4">
            <LogIn className="size-4 sm:hidden" />
            <span className="hidden sm:inline">{t("login")}</span>
          </Link>
          {/* Samma avvägning som på startsidan: raden blev 448 px bred på en
              390 px skärm. Registreringen finns i teaser-kortet i listan. */}
          <Link href="/register" className="btn-primary hidden px-3 text-xs sm:inline-flex sm:px-4 sm:text-sm">
            {t("register")}
          </Link>
        </nav>
      </div>
    </AutoHideHeader>
  );
}

export async function AppNav({ user }: { user: { name: string; email: string; role?: string | null } }) {
  const t = await getTranslations("nav");
  const links = [
    { href: "/lagenheter", label: t("listings") },
    { href: "/bevakningar", label: t("watches") },
    { href: "/konto", label: t("account") },
    { href: "/pro", label: t("pro") },
    ...(user.role === "admin" ? [{ href: "/admin", label: t("admin") }] : []),
  ];
  return (
    <AutoHideHeader>
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Logo href="/" />
          <NavLinks links={links} />
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <ThemeSwitcher compact />
          <LocaleSwitcher compact />
          {/* Namnet är det första som får vika: det frigör ~100 px i spannet
              där länkraden precis får plats. */}
          <Link href="/konto" className="hidden max-w-32 truncate text-sm text-muted xl:block">
            {user.name}
          </Link>
          <SignOutButton />
        </div>
      </div>
      {/* Under lg får länkarna en egen scrollbar rad. Med fem länkar, temaväxlare,
          språkväljare och utloggning blir den inbakade raden ~990 px bred, och
          fick aldrig plats mellan 640 och 1024 px. */}
      <div className="border-t border-line lg:hidden">
        <div className="mx-auto max-w-7xl overflow-x-auto px-2">
          <NavLinks links={links} mobile />
        </div>
      </div>
    </AutoHideHeader>
  );
}

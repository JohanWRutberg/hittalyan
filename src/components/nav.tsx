import Link from "next/link";
import { LogIn } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
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
          <LocaleSwitcher compact />
          <Link href="/login" title={t("login")} aria-label={t("login")} className="btn-ghost px-2 sm:px-4">
            <LogIn className="size-4 sm:hidden" />
            <span className="hidden sm:inline">{t("login")}</span>
          </Link>
          <Link href="/register" className="btn-primary px-3 text-xs sm:px-4 sm:text-sm">
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
          <LocaleSwitcher compact />
          <Link href="/konto" className="hidden text-sm text-muted sm:block">
            {user.name}
          </Link>
          <SignOutButton />
        </div>
      </div>
      <div className="border-t border-line sm:hidden">
        <div className="mx-auto max-w-7xl overflow-x-auto px-2">
          <NavLinks links={links} mobile />
        </div>
      </div>
    </AutoHideHeader>
  );
}

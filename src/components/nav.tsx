import Link from "next/link";
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
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo href="/" />
        <nav className="flex items-center gap-2">
          <LocaleSwitcher compact />
          <Link href="/login" className="btn-ghost">
            {t("login")}
          </Link>
          <Link href="/register" className="btn-primary">
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
    { href: "/app", label: t("listings") },
    { href: "/app/bevakningar", label: t("watches") },
    { href: "/app/konto", label: t("account") },
    { href: "/app/pro", label: t("pro") },
    ...(user.role === "admin" ? [{ href: "/app/admin", label: t("admin") }] : []),
  ];
  return (
    <AutoHideHeader>
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Logo href="/" />
          <NavLinks links={links} />
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleSwitcher compact />
          <Link href="/app/konto" className="hidden text-sm text-muted sm:block">
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

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { signOut } from "@/lib/auth-client";

export function NavLinks({ links, mobile }: { links: { href: string; label: string }[]; mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={mobile ? "flex gap-1 py-1" : "hidden items-center gap-1 sm:flex"}>
      {links.map((l) => {
        const active = l.href === "/app" ? pathname === "/app" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`relative rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active ? "text-brand-700" : "text-muted hover:text-ink"
            }`}
          >
            {active && (
              <motion.span
                layoutId={mobile ? "nav-active-mobile" : "nav-active"}
                className="absolute inset-0 rounded-lg bg-brand-50"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function SignOutButton() {
  const t = useTranslations("common");
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn-ghost px-2.5"
      title={t("logout")}
      onClick={async () => {
        await signOut();
        router.push("/");
        router.refresh();
      }}
    >
      <LogOut className="size-4" />
      <span className="hidden sm:inline">{t("logout")}</span>
    </button>
  );
}

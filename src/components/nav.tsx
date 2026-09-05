import Link from "next/link";
import { Logo } from "@/components/logo";
import { NavLinks, SignOutButton } from "@/components/nav-client";

export function AppNav({ user }: { user: { name: string; email: string; role?: string | null } }) {
  const links = [
    { href: "/app", label: "Lägenheter" },
    { href: "/app/bevakningar", label: "Bevakningar" },
    { href: "/app/konto", label: "Konto" },
    ...(user.role === "admin" ? [{ href: "/app/admin", label: "Admin" }] : []),
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Logo href="/" />
          <NavLinks links={links} />
        </div>
        <div className="flex items-center gap-3">
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
    </header>
  );
}

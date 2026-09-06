import { getSession } from "@/lib/session";
import { AppNav, PublicNav } from "@/components/nav";
import { SiteFooter } from "@/components/site-footer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="flex flex-1 flex-col">
      {session ? <AppNav user={session.user} /> : <PublicNav />}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <SiteFooter />
    </div>
  );
}

import { requireSession } from "@/lib/session";
import { AppNav } from "@/components/nav";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const session = await requireSession();
  return (
    <div className="flex flex-1 flex-col">
      <AppNav user={session.user} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

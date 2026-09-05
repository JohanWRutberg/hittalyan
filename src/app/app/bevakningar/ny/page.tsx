import type { Metadata } from "next";
import { getAreaCounts, getAreaMap } from "@/lib/areas";
import { filtersToWhere, parseFilters, type SearchParams } from "@/lib/filters";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { WatchForm } from "@/components/watch-form";
import { redirect } from "next/navigation";
import { hasPro } from "@/lib/plan";

export const metadata: Metadata = { title: "Ny bevakning" };

export default async function NewWatchPage({ searchParams }: PageProps<"/app/bevakningar/ny">) {
  const session = await requireSession();
  const me = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (!hasPro(me)) redirect("/app/pro?status=required");
  const sp = (await searchParams) as SearchParams;
  const [areas, counts, pushCount] = await Promise.all([
    getAreaMap(),
    getAreaCounts(filtersToWhere(parseFilters({}))),
    prisma.pushSubscription.count({ where: { userId: session.user.id } }),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ny bevakning</h1>
        <p className="mt-1 text-sm text-muted">Tomma fält betyder &quot;spelar ingen roll&quot;.</p>
      </div>
      <WatchForm areas={areas} initialFilters={parseFilters(sp)} pushReady={pushCount > 0} counts={counts} />
    </div>
  );
}

import type { Metadata } from "next";
import { getAreaCounts, getAreaMap } from "@/lib/areas";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { watchToFilters } from "@/lib/watch-filters";
import { filtersToWhere, parseFilters } from "@/lib/filters";
import { WatchForm } from "@/components/watch-form";
import { notFound, redirect } from "next/navigation";
import { hasPro } from "@/lib/plan";

export const metadata: Metadata = { title: "Redigera bevakning" };

export default async function EditWatchPage({ params }: PageProps<"/app/bevakningar/[id]">) {
  const { id } = await params;
  const session = await requireSession();
  const me = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (!hasPro(me)) redirect("/app/pro?status=required");
  const [watch, areas, counts, pushCount] = await Promise.all([
    prisma.watch.findFirst({ where: { id, userId: session.user.id } }),
    getAreaMap(),
    getAreaCounts(filtersToWhere(parseFilters({}))),
    prisma.pushSubscription.count({ where: { userId: session.user.id } }),
  ]);
  if (!watch) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Redigera bevakning</h1>
        <p className="mt-1 text-sm text-muted">{watch.name}</p>
      </div>
      <WatchForm areas={areas} watch={watch} initialFilters={watchToFilters(watch)} pushReady={pushCount > 0} counts={counts} />
    </div>
  );
}

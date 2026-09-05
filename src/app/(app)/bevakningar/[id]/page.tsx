import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAreaCounts, getAreaMap } from "@/lib/areas";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { watchToFilters } from "@/lib/watch-filters";
import { filtersToWhere, parseFilters } from "@/lib/filters";
import { WatchForm } from "@/components/watch-form";
import { notFound, redirect } from "next/navigation";
import { hasPro } from "@/lib/plan";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.pages");
  return { title: t("editWatch") };
}

export default async function EditWatchPage({ params }: PageProps<"/bevakningar/[id]">) {
  const { id } = await params;
  const t = await getTranslations("watches.form");
  const session = await requireSession();
  const me = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (!hasPro(me)) redirect("/pro?status=required");
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
        <h1 className="text-3xl font-bold tracking-tight">{t("titleEdit")}</h1>
        <p className="mt-1 text-sm text-muted">{watch.name}</p>
      </div>
      <WatchForm areas={areas} watch={watch} initialFilters={watchToFilters(watch)} pushReady={pushCount > 0} counts={counts} />
    </div>
  );
}

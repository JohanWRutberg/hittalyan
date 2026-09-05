import type { Metadata } from "next";
import Link from "next/link";
import { BellPlus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { filtersToWhere } from "@/lib/filters";
import { watchToFilters } from "@/lib/watch-filters";
import { WatchCard } from "@/components/watch-card";
import { ProGate } from "@/components/pro-gate";
import { describePlan, planState } from "@/lib/plan";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.pages");
  return { title: t("watches") };
}

export default async function WatchesPage() {
  const t = await getTranslations("watches");
  const tPro = await getTranslations("pro");
  const locale = (await getLocale()) as Locale;
  const session = await requireSession();
  const [user, watches] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id } }),
    prisma.watch.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const info = describePlan(planState(user), (k, v) => tPro(k, v), (d) => formatDate(d, locale));
  const hits = await Promise.all(watches.map((w) => prisma.listing.count({ where: filtersToWhere(watchToFilters(w)) })));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("lead")}</p>
        </div>
        {info.active ? (
          <Link href="/app/bevakningar/ny" className="btn-primary">
            <BellPlus className="size-4" /> {t("new")}
          </Link>
        ) : (
          <Link href="/app/pro" className="btn-primary">
            <BellPlus className="size-4" /> {t("getPro")}
          </Link>
        )}
      </div>

      {!info.active && <ProGate info={info} what={t("gateWhat")} />}
      {!info.active && watches.length > 0 && (
        <p className="text-sm text-muted">{t("keptNotice", { count: watches.length })}</p>
      )}

      {info.active && watches.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-lg font-semibold">{t("empty.title")}</p>
          <p className="mt-1 text-sm text-muted">{t("empty.lead")}</p>
          <Link href="/app/bevakningar/ny" className="btn-primary mt-6">
            <BellPlus className="size-4" /> {t("empty.cta")}
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {watches.map((w, i) => (
            <WatchCard key={w.id} watch={w} hits={hits[i]} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

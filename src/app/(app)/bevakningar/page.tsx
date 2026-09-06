import type { Metadata } from "next";
import Link from "next/link";
import { BellPlus, Heart } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { filtersToWhere } from "@/lib/filters";
import { watchToFilters } from "@/lib/watch-filters";
import { WatchCard } from "@/components/watch-card";
import { ListingCard } from "@/components/listing-card";
import { HoveredListingProvider } from "@/components/hovered-listing";
import { ProGate } from "@/components/pro-gate";
import { describePlan, planState } from "@/lib/plan";
import { formatDate } from "@/lib/format";
import { queueYears } from "@/lib/chance";
import type { Locale } from "@/i18n/config";
import { marketOf } from "@/lib/markets";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.pages");
  return { title: t("watches") };
}

type Tab = "bevakningar" | "favoriter";

export default async function WatchesPage({ searchParams }: PageProps<"/bevakningar">) {
  const t = await getTranslations("watches");
  const tf = await getTranslations("favorites");
  const tPro = await getTranslations("pro");
  const locale = (await getLocale()) as Locale;
  const session = await requireSession();
  const sp = await searchParams;
  const tab: Tab = sp.flik === "favoriter" ? "favoriter" : "bevakningar";

  const [user, watches, favorites, queues] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id } }),
    prisma.watch.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "asc" } }),
    prisma.favorite.findMany({
      where: { userId: session.user.id },
      include: { listing: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userQueue.findMany({ where: { userId: session.user.id }, select: { market: true, registeredAt: true } }),
  ]);
  const info = describePlan(planState(user), (k, v) => tPro(k, v), (d) => formatDate(d, locale));
  const hits = await Promise.all(
    watches.map((w) => prisma.listing.count({ where: filtersToWhere(watchToFilters(w), marketOf(w.market)) })),
  );

  // Favoriter kan spänna över flera köer, så chansen räknas mot kötiden i den kö
  // annonsen faktiskt tillhör.
  const yearsByMarket = new Map(queues.map((q) => [q.market, queueYears(q.registeredAt)]));

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "bevakningar", label: t("title"), count: watches.length },
    { key: "favoriter", label: tf("title"), count: favorites.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{tab === "favoriter" ? tf("title") : t("title")}</h1>
          <p className="mt-1 text-sm text-muted">{tab === "favoriter" ? tf("lead") : t("lead")}</p>
        </div>
        {tab === "bevakningar" &&
          (info.active ? (
            <Link href="/bevakningar/ny" className="btn-primary">
              <BellPlus className="size-4" /> {t("new")}
            </Link>
          ) : (
            <Link href="/pro" className="btn-primary">
              <BellPlus className="size-4" /> {t("getPro")}
            </Link>
          ))}
      </div>

      <div className="flex gap-1 border-b border-line">
        {tabs.map((x) => (
          <Link
            key={x.key}
            href={x.key === "bevakningar" ? "/bevakningar" : "/bevakningar?flik=favoriter"}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === x.key ? "border-brand-600 text-brand-700" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {x.label}
            <span className="ml-1.5 text-xs font-medium text-muted">{x.count}</span>
          </Link>
        ))}
      </div>

      {!info.active && <ProGate info={info} what={tab === "favoriter" ? tf("gateWhat") : t("gateWhat")} />}

      {tab === "bevakningar" ? (
        <>
          {!info.active && watches.length > 0 && <p className="text-sm text-muted">{t("keptNotice", { count: watches.length })}</p>}
          {info.active && watches.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-lg font-semibold">{t("empty.title")}</p>
              <p className="mt-1 text-sm text-muted">{t("empty.lead")}</p>
              <Link href="/bevakningar/ny" className="btn-primary mt-6">
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
        </>
      ) : favorites.length === 0 ? (
        <div className="card p-12 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <Heart className="size-6" />
          </span>
          <p className="mt-4 text-lg font-semibold">{tf("empty.title")}</p>
          <p className="mt-1 text-sm text-muted">{tf("empty.lead")}</p>
          <Link href="/lagenheter" className="btn-primary mt-6">
            {tf("empty.cta")}
          </Link>
        </div>
      ) : (
        <>
          {favorites.some((f) => !f.listing.active) && <p className="text-sm text-muted">{tf("expiredNotice")}</p>}
          <HoveredListingProvider>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {favorites.map((f, i) => (
                <div key={f.id} className={f.listing.active ? "" : "opacity-60"}>
                  <ListingCard
                    listing={f.listing}
                    index={i}
                    userYears={yearsByMarket.get(f.listing.market) ?? null}
                    favorited={info.active ? true : undefined}
                  />
                </div>
              ))}
            </div>
          </HoveredListingProvider>
        </>
      )}
    </div>
  );
}

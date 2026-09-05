import type { Metadata } from "next";
import { Clock3, HelpCircle, LogIn, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAreaCounts, getAreaMap } from "@/lib/areas";
import { countActiveFilters, parseFilters, filtersToWhere, type SearchParams } from "@/lib/filters";
import { getLocale, getTranslations } from "next-intl/server";
import { dayAgo, formatDateTime, formatYearsShort, hoursAgo, queueTime } from "@/lib/format";
import { queueYears } from "@/lib/chance";
import { HoveredListingProvider } from "@/components/hovered-listing";
import type { Locale } from "@/i18n/config";
import { getSession } from "@/lib/session";
import { watchToFilters } from "@/lib/watch-filters";
import { FilterPanel } from "@/components/filter-panel";
import { ListingCard } from "@/components/listing-card";
import { ListingsMap, type MapPoint } from "@/components/listings-map";
import { SortBar } from "@/components/sort-bar";
import { PushGuide } from "@/components/push-guide";
import { parseSorts, sortsToOrderBy } from "@/lib/sort";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.pages");
  return { title: t("listings") };
}

const PAGE_SIZE = 60;

export default async function ListingsPage({ searchParams }: PageProps<"/app">) {
  const sp = (await searchParams) as SearchParams;
  const t = await getTranslations("listings");
  const locale = (await getLocale()) as Locale;
  const session = await getSession();
  if (!session) return <PublicListings sp={sp} />;

  let filters = parseFilters(sp);
  if (typeof sp.bevakning === "string") {
    const w = await prisma.watch.findFirst({ where: { id: sp.bevakning, userId: session.user.id } });
    if (w) filters = watchToFilters(w);
  }
  const page = Math.max(1, Number(sp.sida ?? 1) || 1);
  const where = filtersToWhere(filters);
  const sorts = parseSorts(sp);
  // Antal per område: samma filter som listan, men utan valda kommuner/stadsdelar
  const areaWhere = filtersToWhere({ ...filters, kommuner: [], stadsdelar: [] });

  const [areas, total, listings, newLast24h, lastRun, user, mapRows, areaCounts] = await Promise.all([
    getAreaMap(),
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      orderBy: sortsToOrderBy(sorts),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    // Samma filter som listan, så "nya" alltid är en delmängd av totalen
    prisma.listing.count({ where: { AND: [where, { firstSeenAt: { gte: dayAgo() } }] } }),
    prisma.pollRun.findFirst({ where: { ok: true }, orderBy: { startedAt: "desc" } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { queueRegisteredAt: true } }),
    prisma.listing.findMany({
      where: { ...where, lat: { not: null }, lng: { not: null } },
      orderBy: [{ firstSeenAt: "desc" }, { id: "desc" }],
      take: 1500,
      select: {
        id: true, lat: true, lng: true, gatuadress: true, stadsdel: true, kommun: true,
        antalRum: true, yta: true, hyra: true, vaning: true, url: true, nyproduktion: true, firstSeenAt: true,
        kotidQ1: true, kotidQ3: true,
      },
    }),
    getAreaCounts(areaWhere),
  ]);

  const cutoff = dayAgo();
  const mapPoints: MapPoint[] = mapRows.map((r) => ({
    id: r.id,
    lat: r.lat!,
    lng: r.lng!,
    gatuadress: r.gatuadress,
    stadsdel: r.stadsdel,
    kommun: r.kommun,
    antalRum: r.antalRum,
    yta: r.yta,
    hyra: r.hyra,
    vaning: r.vaning,
    url: r.url,
    nyproduktion: r.nyproduktion,
    kotidQ1: r.kotidQ1,
    kotidQ3: r.kotidQ3,
    isNew: r.firstSeenAt >= cutoff,
  }));

  const activeCount = countActiveFilters(filters);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qt = user?.queueRegisteredAt ? queueTime(user.queueRegisteredAt) : null;
  const userYears = user?.queueRegisteredAt ? queueYears(user.queueRegisteredAt) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">
            {t("count", { count: total })}
            {activeCount > 0 && t("matchFilter")} · {t("newLast24h", { count: newLast24h })}
            {lastRun?.finishedAt && ` · ${t("updatedAt", { time: formatDateTime(lastRun.finishedAt, locale) })}`}
          </p>
        </div>
        <Link
          href="/app/konto"
          className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 shadow-soft transition hover:shadow-lift ${
            qt ? "border-brand-200 bg-white" : "border-amber-200 bg-amber-50"
          }`}
        >
          <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${qt ? "bg-brand-50 text-brand-700" : "bg-amber-100 text-amber-700"}`}>
            {qt ? <Clock3 className="size-4.5" /> : <HelpCircle className="size-4.5" />}
          </span>
          <span className="leading-tight">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">{t("queueBadge.label")}</span>
            {qt ? (
              <span className="block text-base font-bold text-ink">
                {t("queueBadge.value", { years: qt.years, days: qt.days })}
                <span className="ml-1.5 text-xs font-medium text-muted">≈ {formatYearsShort(userYears!, locale)}</span>
              </span>
            ) : (
              <span className="block text-sm font-semibold text-amber-800">{t("queueBadge.missing")}</span>
            )}
          </span>
        </Link>
      </div>

      <PushGuide variant="banner" />

      <FilterPanel areas={areas} filters={filters} activeCount={activeCount} counts={areaCounts} />

      <HoveredListingProvider>
        <div className="space-y-6">
          <ListingsMap points={mapPoints} userYears={userYears} sticky />

          <SortBar sorts={sorts} sp={sp} />

          {listings.length === 0 ? (
            <div className="card p-12 text-center text-muted">{t("empty")}</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {listings.map((l, i) => (
                <ListingCard key={l.id} listing={l} index={i} userYears={userYears} />
              ))}
            </div>
          )}
        </div>
      </HoveredListingProvider>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => {
            const q = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (v == null ? [] : Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]])) as [string, string][]);
            q.set("sida", String(p));
            return (
              <Link key={p} href={`/app?${q}`} className={p === page ? "btn-primary px-3 py-1.5" : "btn-secondary px-3 py-1.5"}>
                {p}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

/**
 * Begränsat läge för utloggade: alla tillgängliga annonser (vanliga kön), nyast först,
 * med sidbläddring. Filter, sortering, karta, chans och bevakningar kräver inloggning,
 * och eventuella filter-/sorteringsparametrar i adressen ignoreras här.
 */
/** Utloggade ser annonser först efter så här många timmar (PUBLIC_DELAY_HOURS, standard 24). */
const PUBLIC_DELAY_HOURS = Math.max(0, Number(process.env.PUBLIC_DELAY_HOURS ?? 24) || 0);

async function PublicListings({ sp }: { sp: SearchParams }) {
  const t = await getTranslations("listings");
  const tc = await getTranslations("common");
  const locale = (await getLocale()) as Locale;
  const page = Math.max(1, Number(sp.sida ?? 1) || 1);
  const delayCutoff = hoursAgo(PUBLIC_DELAY_HOURS);
  const base = filtersToWhere(parseFilters({}));
  const where = { AND: [base, { firstSeenAt: { lte: delayCutoff } }] };
  const hiddenWhere = { AND: [base, { firstSeenAt: { gt: delayCutoff } }] };
  const [total, listings, hiddenCount, lastRun, mapRows] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({ where, orderBy: [{ firstSeenAt: "desc" }, { id: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.listing.count({ where: hiddenWhere }),
    prisma.pollRun.findFirst({ where: { ok: true }, orderBy: { startedAt: "desc" } }),
    prisma.listing.findMany({
      where: { ...where, lat: { not: null }, lng: { not: null } },
      orderBy: [{ firstSeenAt: "desc" }, { id: "desc" }],
      take: 1500,
      select: {
        id: true, lat: true, lng: true, gatuadress: true, stadsdel: true, kommun: true,
        antalRum: true, yta: true, hyra: true, vaning: true, url: true, nyproduktion: true, firstSeenAt: true,
        kotidQ1: true, kotidQ3: true,
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cutoff = dayAgo();
  const delayLabel = PUBLIC_DELAY_HOURS === 24 ? t("public.delayLabel24") : t("public.delayLabelHours", { hours: PUBLIC_DELAY_HOURS });
  const mapPoints: MapPoint[] = mapRows.map((r) => ({
    id: r.id, lat: r.lat!, lng: r.lng!, gatuadress: r.gatuadress, stadsdel: r.stadsdel, kommun: r.kommun,
    antalRum: r.antalRum, yta: r.yta, hyra: r.hyra, vaning: r.vaning, url: r.url, nyproduktion: r.nyproduktion,
    kotidQ1: r.kotidQ1, kotidQ3: r.kotidQ3, isNew: r.firstSeenAt >= cutoff,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("publicTitle")}</h1>
        <p className="mt-1 text-sm text-muted">
          {t("count", { count: total })}
          {hiddenCount > 0 && ` · ${t("public.hiddenCount", { count: hiddenCount, label: delayLabel })}`}
          {lastRun?.finishedAt && ` · ${t("updatedAt", { time: formatDateTime(lastRun.finishedAt, locale) })}`}
        </p>
      </div>

      <div className="card flex flex-col gap-4 border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-brand-700 shadow-soft">
            <Sparkles className="size-5" />
          </span>
          <div>
            <p className="font-semibold">
              {PUBLIC_DELAY_HOURS > 0
                ? t("public.bannerDelayed", {
                    delay: PUBLIC_DELAY_HOURS === 24 ? t("public.delay24") : t("public.delayHours", { hours: PUBLIC_DELAY_HOURS }),
                  })
                : t("public.bannerFull")}
            </p>
            <p className="text-sm text-muted">{t("public.bannerLead")}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/login" className="btn-secondary">
            <LogIn className="size-4" /> {tc("login")}
          </Link>
          <Link href="/register" className="btn-primary">
            {tc("register")}
          </Link>
        </div>
      </div>

      <HoveredListingProvider>
        <div className="space-y-6">
          <ListingsMap points={mapPoints} userYears={null} sticky />

          {hiddenCount > 0 && page === 1 && <HiddenTeaser count={hiddenCount} label={delayLabel} />}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {listings.map((l, i) => (
              <ListingCard key={l.id} listing={l} index={i} showChance={false} />
            ))}
          </div>
        </div>
      </HoveredListingProvider>

      {pages > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-2 text-sm">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={`/app?sida=${p}`} className={p === page ? "btn-primary px-3 py-1.5" : "btn-secondary px-3 py-1.5"}>
              {p}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

/** Låst teaser: suddade platshållarkort (ingen riktig data) och antal dolda nya annonser. */
async function HiddenTeaser({ count, label }: { count: number; label: string }) {
  const t = await getTranslations("listings");
  const tc = await getTranslations("common");
  const widths = [
    ["w-32", "w-40"],
    ["w-28", "w-48"],
    ["w-36", "w-44"],
  ];
  return (
    <div className="grid">
      <div className="grid gap-4 [grid-area:1/1] sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
        {widths.map(([a, b], i) => (
          <div key={i} className={`card select-none p-5 blur-[6px] ${i === 2 ? "hidden xl:block" : i === 1 ? "hidden sm:block" : ""}`}>
            <div className="flex items-center gap-2">
              <span className="chip border-brand-200 bg-brand-50 text-brand-700">{t("card.new")}</span>
              <span className={`h-3 rounded bg-slate-200 ${a}`} />
            </div>
            <div className={`mt-3 h-5 rounded bg-slate-300 ${b}`} />
            <div className="mt-4 grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((k) => (
                <div key={k} className="h-12 rounded-xl bg-canvas" />
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <span className="h-6 w-16 rounded-full bg-slate-100" />
              <span className="h-6 w-12 rounded-full bg-slate-100" />
            </div>
            <div className="mt-4 h-3 w-full rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="relative z-10 flex items-center justify-center p-2 [grid-area:1/1] sm:p-4">
        <div className="card flex max-w-md flex-col items-center gap-3 border-brand-200 p-5 text-center shadow-lift sm:p-6">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-600 text-white shadow-soft">
            <Lock className="size-5" />
          </span>
          <p className="text-lg font-semibold">{t("public.teaserTitle", { count, label })}</p>
          <p className="text-sm text-muted">{t("public.teaserText")}</p>
          <div className="mt-1 flex gap-2">
            <Link href="/login" className="btn-secondary">{tc("login")}</Link>
            <Link href="/register" className="btn-primary">{tc("register")}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

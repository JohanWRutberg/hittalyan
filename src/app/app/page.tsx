import type { Metadata } from "next";
import { Clock3 } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAreaMap } from "@/lib/areas";
import { countActiveFilters, parseFilters, filtersToWhere, type SearchParams } from "@/lib/filters";
import { dayAgo, formatDateTime, queueTime } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { watchToFilters } from "@/lib/watch-filters";
import { FilterPanel } from "@/components/filter-panel";
import { ListingCard } from "@/components/listing-card";
import { ListingsMap, type MapPoint } from "@/components/listings-map";

export const metadata: Metadata = { title: "Lägenheter" };

const PAGE_SIZE = 60;

export default async function ListingsPage({ searchParams }: PageProps<"/app">) {
  const sp = (await searchParams) as SearchParams;
  const session = await requireSession();
  let filters = parseFilters(sp);
  if (typeof sp.bevakning === "string") {
    const w = await prisma.watch.findFirst({ where: { id: sp.bevakning, userId: session.user.id } });
    if (w) filters = watchToFilters(w);
  }
  const page = Math.max(1, Number(sp.sida ?? 1) || 1);
  const where = filtersToWhere(filters);

  const [areas, total, listings, newLast24h, lastRun, user, mapRows] = await Promise.all([
    getAreaMap(),
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      orderBy: [{ firstSeenAt: "desc" }, { id: "desc" }],
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
      },
    }),
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
    isNew: r.firstSeenAt >= cutoff,
  }));

  const activeCount = countActiveFilters(filters);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qt = user?.queueRegisteredAt ? queueTime(user.queueRegisteredAt) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lägenheter</h1>
          <p className="mt-1 text-sm text-muted">
            {total} {total === 1 ? "annons" : "annonser"}
            {activeCount > 0 && " matchar ditt filter"} · {newLast24h} nya senaste dygnet
            {lastRun?.finishedAt && ` · uppdaterat ${formatDateTime(lastRun.finishedAt)}`}
          </p>
        </div>
        <Link href="/app/konto" className="chip py-1.5 hover:border-brand-300">
          <Clock3 className="size-3.5 text-brand-600" />
          {qt ? `Kötid ${qt.years} år ${qt.days} dagar` : "Ange din kötid"}
        </Link>
      </div>

      <FilterPanel areas={areas} filters={filters} activeCount={activeCount} />

      <ListingsMap points={mapPoints} />

      {listings.length === 0 ? (
        <div className="card p-12 text-center text-muted">
          Inga annonser matchar just nu. Spara filtret som en bevakning så säger vi till när något dyker upp.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listings.map((l, i) => (
            <ListingCard key={l.id} listing={l} index={i} />
          ))}
        </div>
      )}

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

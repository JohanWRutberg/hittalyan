import type { Metadata } from "next";
import Link from "next/link";
import { BellPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { filtersToWhere } from "@/lib/filters";
import { watchToFilters } from "@/lib/watch-filters";
import { WatchCard } from "@/components/watch-card";
import { ProGate } from "@/components/pro-gate";
import { planInfo } from "@/lib/plan";

export const metadata: Metadata = { title: "Bevakningar" };

export default async function WatchesPage() {
  const session = await requireSession();
  const [user, watches] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id } }),
    prisma.watch.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const info = planInfo(user);
  const hits = await Promise.all(watches.map((w) => prisma.listing.count({ where: filtersToWhere(watchToFilters(w)) })));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bevakningar</h1>
          <p className="mt-1 text-sm text-muted">Varje bevakning är ett sparat filter. Ny annons som matchar ger mail och notis.</p>
        </div>
        {info.active ? (
          <Link href="/app/bevakningar/ny" className="btn-primary">
            <BellPlus className="size-4" /> Ny bevakning
          </Link>
        ) : (
          <Link href="/app/pro" className="btn-primary">
            <BellPlus className="size-4" /> Skaffa Pro
          </Link>
        )}
      </div>

      {!info.active && <ProGate info={info} what="Bevakningar" />}
      {!info.active && watches.length > 0 && (
        <p className="text-sm text-muted">Dina {watches.length} sparade bevakningar finns kvar men skickar inga notiser förrän Pro är aktivt igen.</p>
      )}

      {info.active && watches.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-lg font-semibold">Du har inga bevakningar än</p>
          <p className="mt-1 text-sm text-muted">Skapa en för t.ex. ett specifikt hus, ett område eller ett prisintervall.</p>
          <Link href="/app/bevakningar/ny" className="btn-primary mt-6">
            <BellPlus className="size-4" /> Skapa din första bevakning
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

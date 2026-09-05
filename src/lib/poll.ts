import { prisma } from "@/lib/prisma";
import { fetchAllListings } from "@/lib/bostad";
import { listingMatches } from "@/lib/matching";
import { sendWatchEmail, sendWatchPush } from "@/lib/notify";
import type { Listing } from "@/generated/prisma/client";
import { hasPro } from "@/lib/plan";

export interface PollResult {
  total: number;
  newCount: number;
  updated: number;
  deactivated: number;
  notified: number;
  runId: string;
}

/**
 * Hämtar alla annonser, sparar nya, avaktiverar borttagna och skickar notiser
 * till bevakningar som matchar de nya annonserna.
 */
export async function runPoll(): Promise<PollResult> {
  const run = await prisma.pollRun.create({ data: {} });
  try {
    const listings = await fetchAllListings();
    const now = new Date();

    const existing = await prisma.listing.findMany({
      select: { id: true, kotidQ1: true, kotidQ3: true, hyra: true, annonseradTill: true, vaning: true, yta: true, antalRum: true },
    });
    const existingIds = new Set(existing.map((e) => e.id));
    const existingById = new Map(existing.map((e) => [e.id, e]));
    const isFirstRun = existingIds.size === 0;

    // Få frågor i stället för en per annons: serverless-funktioner har kort tidsgräns.
    const incomingNew = listings.filter((l) => !existingIds.has(l.id));
    const currentIds = listings.map((l) => l.id);

    if (incomingNew.length) {
      await prisma.listing.createMany({
        data: incomingNew.map((l) => ({ ...l, firstSeenAt: now, lastSeenAt: now, active: true })),
        skipDuplicates: true,
      });
    }
    await prisma.listing.updateMany({
      where: { id: { in: currentIds } },
      data: { lastSeenAt: now, active: true },
    });

    // Befintliga annonser vars uppgifter ändrats (t.ex. kötidsstatistik eller sista dag)
    // uppdateras individuellt. Det är sällan, så det kostar lite.
    const changed = listings.filter((l) => {
      const e = existingById.get(l.id);
      if (!e) return false;
      return (
        e.kotidQ1 !== l.kotidQ1 ||
        e.kotidQ3 !== l.kotidQ3 ||
        e.hyra !== l.hyra ||
        e.vaning !== l.vaning ||
        e.yta !== l.yta ||
        e.antalRum !== l.antalRum ||
        (e.annonseradTill?.getTime() ?? null) !== (l.annonseradTill?.getTime() ?? null)
      );
    });
    for (const l of changed) {
      await prisma.listing.update({ where: { id: l.id }, data: { ...l, lastSeenAt: now, active: true } });
    }
    const { count: deactivated } = await prisma.listing.updateMany({
      where: { active: true, id: { notIn: currentIds } },
      data: { active: false },
    });

    const newListings: Listing[] = incomingNew.length
      ? await prisma.listing.findMany({ where: { id: { in: incomingNew.map((l) => l.id) } } })
      : [];

    // Första körningen fyller bara databasen – annars skulle alla få 700 notiser.
    const notified = isFirstRun ? 0 : await notifyWatches(newListings);

    await prisma.pollRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: true, total: listings.length, newCount: newListings.length, notified },
    });
    return { total: listings.length, newCount: newListings.length, updated: changed.length, deactivated, notified, runId: run.id };
  } catch (err) {
    await prisma.pollRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, error: (err as Error).message },
    });
    throw err;
  }
}

async function notifyWatches(newListings: Listing[]): Promise<number> {
  if (!newListings.length) return 0;
  const watches = await prisma.watch.findMany({
    where: { enabled: true },
    include: { user: { include: { pushSubscriptions: true } } },
  });

  let notified = 0;
  for (const watch of watches) {
    if (!hasPro(watch.user)) continue; // bevakningar är en Pro-funktion
    const matches = newListings.filter((l) => listingMatches(l, watch));
    if (!matches.length) continue;

    // Hoppa över annonser som redan notifierats för denna bevakning
    const already = await prisma.notification.findMany({
      where: { watchId: watch.id, listingId: { in: matches.map((m) => m.id) } },
      select: { listingId: true },
    });
    const alreadyIds = new Set(already.map((a) => a.listingId));
    const fresh = matches.filter((m) => !alreadyIds.has(m.id));
    if (!fresh.length) continue;

    const emailSent = watch.notifyEmail ? await sendWatchEmail(watch.user.email, watch, fresh, watch.user.locale) : false;
    const pushSent = watch.notifyPush ? await sendWatchPush(watch.user.pushSubscriptions, watch, fresh, watch.user.locale) : false;

    await prisma.notification.createMany({
      data: fresh.map((l) => ({ userId: watch.userId, watchId: watch.id, listingId: l.id, emailSent, pushSent })),
      skipDuplicates: true,
    });
    notified += fresh.length;
  }
  return notified;
}

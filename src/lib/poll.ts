import { prisma } from "@/lib/prisma";
import { fetchAllListings } from "@/lib/bostad";
import { listingMatches } from "@/lib/matching";
import { sendWatchEmail, sendWatchPush } from "@/lib/notify";
import type { Listing } from "@/generated/prisma/client";

export interface PollResult {
  total: number;
  newCount: number;
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

    const existing = await prisma.listing.findMany({ select: { id: true } });
    const existingIds = new Set(existing.map((e) => e.id));
    const isFirstRun = existingIds.size === 0;

    const newListings: Listing[] = [];
    for (const l of listings) {
      const saved = await prisma.listing.upsert({
        where: { id: l.id },
        create: { ...l, firstSeenAt: now, lastSeenAt: now, active: true },
        update: { ...l, lastSeenAt: now, active: true },
      });
      if (!existingIds.has(l.id)) newListings.push(saved);
    }

    const currentIds = listings.map((l) => l.id);
    const { count: deactivated } = await prisma.listing.updateMany({
      where: { active: true, id: { notIn: currentIds } },
      data: { active: false },
    });

    // Första körningen fyller bara databasen – annars skulle alla få 700 notiser.
    const notified = isFirstRun ? 0 : await notifyWatches(newListings);

    await prisma.pollRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: true, total: listings.length, newCount: newListings.length, notified },
    });
    return { total: listings.length, newCount: newListings.length, deactivated, notified, runId: run.id };
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

    const emailSent = watch.notifyEmail ? await sendWatchEmail(watch.user.email, watch, fresh) : false;
    const pushSent = watch.notifyPush ? await sendWatchPush(watch.user.pushSubscriptions, watch, fresh) : false;

    await prisma.notification.createMany({
      data: fresh.map((l) => ({ userId: watch.userId, watchId: watch.id, listingId: l.id, emailSent, pushSent })),
      skipDuplicates: true,
    });
    notified += fresh.length;
  }
  return notified;
}

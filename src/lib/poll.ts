import { prisma } from "@/lib/prisma";
import { listingMatches } from "@/lib/matching";
import { sendWatchEmail, sendWatchPush } from "@/lib/notify";
import type { Listing } from "@/generated/prisma/client";
import { hasPro } from "@/lib/plan";
import { MARKETS, marketInfo, type Market } from "@/lib/markets";
import { SOURCES } from "@/lib/sources";
import type { KnownListing } from "@/lib/sources";

/**
 * Hur länge en körning får hålla på totalt. Ligger med marginal under
 * `maxDuration` (60 s) i /api/cron/poll och på adminsidan.
 *
 * Gränsen gäller **hela** körningen, inte bara extraanropen. Tidigare mättes bara
 * bildhämtningen, medan listhämtningar och databasskrivningar låg utanför – och
 * eftersom de är långsammare i produktion än lokalt slog körningen i taket och
 * Vercel svarade 504.
 */
const DEFAULT_RUN_MS = 40_000;

/** Tid som hålls undan för databasskrivningarna efter att hämtningen är klar. */
const WRITE_RESERVE_MS = 10_000;

export interface MarketPollResult {
  market: Market;
  total: number;
  newCount: number;
  updated: number;
  deactivated: number;
  notified: number;
  runId: string;
}

export interface PollOptions {
  /** Kör bara den här förmedlingen. Utan den körs alla i tur och ordning. */
  market?: Market;
  /** Absolut tidsgräns (epoch-ms) för hela körningen. */
  deadline?: number;
}

export interface PollResult {
  total: number;
  newCount: number;
  updated: number;
  deactivated: number;
  notified: number;
  runId: string;
  markets: MarketPollResult[];
  /** Förmedlingar som inte gick att hämta, med felmeddelande */
  failed: { market: Market; error: string }[];
  /** Förmedlingar som hoppades över för att tiden tog slut; de tas nästa körning. */
  skipped: Market[];
}

/**
 * Kör en hämtning för en eller alla förmedlingar. Körningarna är oberoende: går
 * Boplats Väst ned ska Stockholm ändå uppdateras. Fel samlas i `failed` och kastas
 * bara om ingen enda förmedling gick att hämta.
 *
 * Cron-jobbet anropar en förmedling i taget, så att var och en får hela
 * funktionens tidsgräns för sig. `runPoll()` utan `market` kör alla i tur och
 * ordning och hoppar över dem som inte hinns med – de tas nästa körning.
 */
export async function runPoll(options: PollOptions = {}): Promise<PollResult> {
  const todo = options.market ? [options.market] : MARKETS;
  const runEnd = options.deadline ?? Date.now() + DEFAULT_RUN_MS;
  const markets: MarketPollResult[] = [];
  const failed: { market: Market; error: string }[] = [];
  const skipped: Market[] = [];

  // Tiden delas bara mellan de förmedlingar som behöver extraanrop, och delas om
  // efter varje: blir en klar snabbt får nästa mer tid, och en långsam källa kan
  // aldrig svälta dem som kommer efter.
  let budgetUsersLeft = todo.filter((m) => SOURCES[m].usesFetchBudget).length;

  for (const market of todo) {
    if (Date.now() >= runEnd) {
      skipped.push(market);
      continue;
    }
    let deadline = Date.now();
    if (SOURCES[market].usesFetchBudget) {
      const left = Math.max(0, runEnd - Date.now() - WRITE_RESERVE_MS);
      deadline = Date.now() + left / budgetUsersLeft;
      budgetUsersLeft -= 1;
    }
    try {
      markets.push(await runMarketPoll(market, deadline));
    } catch (err) {
      failed.push({ market, error: (err as Error).message });
      console.error(`[poll:${market}]`, (err as Error).message);
    }
  }

  if (!markets.length && failed.length) {
    throw new Error(failed.map((f) => `${marketInfo(f.market).name}: ${f.error}`).join(" · "));
  }

  const sum = (pick: (m: MarketPollResult) => number) => markets.reduce((a, m) => a + pick(m), 0);
  return {
    total: sum((m) => m.total),
    newCount: sum((m) => m.newCount),
    updated: sum((m) => m.updated),
    deactivated: sum((m) => m.deactivated),
    notified: sum((m) => m.notified),
    runId: markets[markets.length - 1]?.runId ?? "",
    markets,
    failed,
    skipped,
  };
}

/**
 * Hämtar en förmedlings annonser, sparar nya, uppdaterar ändrade, avaktiverar
 * borttagna och notifierar bevakningar som matchar de nya annonserna.
 */
export async function runMarketPoll(market: Market, deadline = Date.now() + DEFAULT_RUN_MS - WRITE_RESERVE_MS): Promise<MarketPollResult> {
  const run = await prisma.pollRun.create({ data: { market } });
  try {
    const existing = await prisma.listing.findMany({
      where: { market },
      select: {
        id: true, refreshedAt: true, kotidQ1: true, kotidQ3: true, kotidSnitt: true, sokande: true,
        hyra: true, annonseradTill: true, vaning: true, yta: true, antalRum: true, active: true,
        images: true, imagesCheckedAt: true,
      },
    });
    const existingById = new Map(existing.map((e) => [e.id, e]));
    const isFirstRun = existing.length === 0;

    const known: Map<string, KnownListing> = new Map(
      existing.map((e) => [
        e.id,
        { refreshedAt: e.refreshedAt, kotidSnitt: e.kotidSnitt, hasImages: e.images.length > 0, imagesCheckedAt: e.imagesCheckedAt },
      ]),
    );
    const { activeIds, listings } = await SOURCES[market].fetchListings(known, deadline);
    // Ett tomt svar är nästan alltid ett fel hos källan, inte en tom bostadskö.
    // Utan den här spärren hade en sådan körning avaktiverat allt vi har.
    if (!activeIds.length) throw new Error(`${marketInfo(market).name} gav inga annonser`);
    const now = new Date();

    // Få frågor i stället för en per annons: serverless-funktioner har kort tidsgräns.
    const incomingNew = listings.filter((l) => !existingById.has(l.id));
    if (incomingNew.length) {
      await prisma.listing.createMany({
        data: incomingNew.map((l) => ({ ...l, firstSeenAt: now, lastSeenAt: now, refreshedAt: now, active: true })),
        skipDuplicates: true,
      });
    }
    if (activeIds.length) {
      await prisma.listing.updateMany({
        where: { id: { in: activeIds } },
        data: { lastSeenAt: now, active: true },
      });
    }

    // Befintliga annonser vars uppgifter ändrats (t.ex. kötidsstatistik, antal
    // sökande eller sista dag) uppdateras individuellt. Det är sällan, så det kostar lite.
    const changed = listings.filter((l) => {
      const e = existingById.get(l.id);
      if (!e) return false;
      return (
        e.kotidQ1 !== l.kotidQ1 ||
        e.kotidQ3 !== l.kotidQ3 ||
        e.kotidSnitt !== l.kotidSnitt ||
        e.sokande !== l.sokande ||
        // `images: undefined` betyder att källan inte hämtade bilder den här
        // körningen, och ska inte räknas som en ändring.
        (l.images !== undefined && !sameImages(e.images, l.images)) ||
        e.hyra !== l.hyra ||
        e.vaning !== l.vaning ||
        e.yta !== l.yta ||
        e.antalRum !== l.antalRum ||
        (e.annonseradTill?.getTime() ?? null) !== (l.annonseradTill?.getTime() ?? null)
      );
    });
    const changedIds = new Set(changed.map((l) => l.id));
    for (const l of changed) {
      await prisma.listing.update({
        where: { id: l.id },
        data: { ...l, lastSeenAt: now, refreshedAt: now, active: true },
      });
    }
    // Annonser vi hämtat om utan att något ändrats räknas ändå som färska, så att
    // källor som turas om att fräscha upp går vidare till nästa annons.
    const unchangedIds = listings.filter((l) => existingById.has(l.id) && !changedIds.has(l.id)).map((l) => l.id);
    if (unchangedIds.length) {
      await prisma.listing.updateMany({ where: { id: { in: unchangedIds } }, data: { refreshedAt: now } });
    }

    // Annonser vi faktiskt försökt hämta bilder för, oavsett om det gav något.
    // Utan den här stämpeln skulle bildlösa annonser hämtas om i all evighet.
    const checkedIds = listings.filter((l) => l.images !== undefined).map((l) => l.id);
    if (checkedIds.length) {
      await prisma.listing.updateMany({ where: { id: { in: checkedIds } }, data: { imagesCheckedAt: now } });
    }

    const { count: deactivated } = await prisma.listing.updateMany({
      where: { market, active: true, id: { notIn: activeIds } },
      data: { active: false },
    });

    const newListings: Listing[] = incomingNew.length
      ? await prisma.listing.findMany({ where: { id: { in: incomingNew.map((l) => l.id) } } })
      : [];

    // Första körningen mot en tom marknad fyller bara databasen – annars skulle
    // alla med en bevakning där få hundratals notiser på en gång.
    const notified = isFirstRun ? 0 : await notifyWatches(market, newListings);

    await prisma.pollRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: true, total: activeIds.length, newCount: newListings.length, notified },
    });
    return {
      market,
      total: activeIds.length,
      newCount: newListings.length,
      updated: changed.length,
      deactivated,
      notified,
      runId: run.id,
    };
  } catch (err) {
    await prisma.pollRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, error: (err as Error).message },
    });
    throw err;
  }
}

const sameImages = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

async function notifyWatches(market: Market, newListings: Listing[]): Promise<number> {
  if (!newListings.length) return 0;
  // Bevakningar följer sin egen förmedling, oavsett vilken kö användaren står i
  // just nu: man kan stå i flera köer.
  const watches = await prisma.watch.findMany({
    where: { enabled: true, market },
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

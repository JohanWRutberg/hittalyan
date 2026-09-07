import { prisma } from "@/lib/prisma";
import { listingMatches } from "@/lib/matching";
import { sendWatchEmail, sendWatchPush } from "@/lib/notify";
import type { DeliveryResult } from "@/lib/notify";
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
  /** Notiser som gick fram i den här körningen, nya såväl som omförsök. */
  notified: number;
  /** Notiser som fortfarande inte gick att leverera. */
  notifyFailed: number;
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
  notifyFailed: number;
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
    notifyFailed: sum((m) => m.notifyFailed),
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
        images: true, imagesCheckedAt: true, queueDates: true, queueDatesAt: true,
      },
    });
    const existingById = new Map(existing.map((e) => [e.id, e]));
    const isFirstRun = existing.length === 0;

    const known: Map<string, KnownListing> = new Map(
      existing.map((e) => [
        e.id,
        {
          refreshedAt: e.refreshedAt,
          kotidSnitt: e.kotidSnitt,
          hasImages: e.images.length > 0,
          imagesCheckedAt: e.imagesCheckedAt,
          queueDatesAt: e.queueDatesAt,
        },
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
        (l.queueDates !== undefined && !sameDates(e.queueDates, l.queueDates)) ||
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
    // Samma sak för kötiderna: stämpeln styr när annonsen står på tur igen.
    const queueCheckedIds = listings.filter((l) => l.queueDates !== undefined).map((l) => l.id);
    if (queueCheckedIds.length) {
      await prisma.listing.updateMany({ where: { id: { in: queueCheckedIds } }, data: { queueDatesAt: now } });
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
    if (!isFirstRun) await recordWatchMatches(market, newListings);
    // Leveransen är ett eget steg och tar med sig notiser som inte gick fram
    // tidigare. Den körs även vid första körningen: då finns inget att skicka,
    // men eventuella gamla misslyckanden ska inte bli liggande.
    const { notified, notifyFailed } = await deliverPending(market);

    await prisma.pollRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: true, total: activeIds.length, newCount: newListings.length, notified, notifyFailed },
    });
    return {
      market,
      total: activeIds.length,
      newCount: newListings.length,
      updated: changed.length,
      deactivated,
      notified,
      notifyFailed,
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
const sameDates = (a: Date[], b: Date[]) => a.length === b.length && a.every((v, i) => v.getTime() === b[i].getTime());

/**
 * Hur länge en notis som inte gått fram är värd att försöka igen. Efter ett dygn är
 * annonsen ändå gammal nyhet, och ett mail då gör mer skada än nytta.
 */
const NOTIFY_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Antal leveransförsök innan vi ger upp. Sex försök täcker tre timmar av pollningar. */
const NOTIFY_MAX_ATTEMPTS = 6;

/** Hur många notiser en enskild körning tar sig an. Håller tiden nere vid en backlog. */
const NOTIFY_BATCH = 100;

/**
 * Skriver ned vilka notiser som ska ut. **Inget skickas här.** Raden är kvittot på
 * att vi lovat en notis, och den skrivs innan något nätverksanrop görs.
 *
 * Tidigare skrevs raden efter sändningen, och alltid som avklarad. Gick mailet inte
 * fram – Resend nekade adressen, `RESEND_API_KEY` saknades, nätverket small – var
 * notisen borta för gott, eftersom annonsen inte längre är ny nästa körning.
 * Det unika indexet på (watchId, listingId) gör fortfarande att samma annons aldrig
 * notifieras två gånger för samma bevakning.
 */
async function recordWatchMatches(market: Market, newListings: Listing[]): Promise<number> {
  if (!newListings.length) return 0;
  // Bevakningar följer sin egen förmedling, oavsett vilken kö användaren står i
  // just nu: man kan stå i flera köer.
  const watches = await prisma.watch.findMany({
    where: { enabled: true, market },
    include: { user: { select: { id: true, plan: true, planExpiresAt: true, planSource: true, role: true, stripeSubscriptionStatus: true } } },
  });

  const rows: { userId: string; watchId: string; listingId: string }[] = [];
  for (const watch of watches) {
    if (!hasPro(watch.user)) continue; // bevakningar är en Pro-funktion
    for (const l of newListings) {
      if (listingMatches(l, watch)) rows.push({ userId: watch.userId, watchId: watch.id, listingId: l.id });
    }
  }
  if (!rows.length) return 0;
  const { count } = await prisma.notification.createMany({ data: rows, skipDuplicates: true });
  return count;
}

/**
 * Skickar de notiser som ännu inte gått fram: både de som nyss skrevs ned och de
 * som misslyckades i en tidigare körning. En bevaknings annonser samlas i ett enda
 * mail, precis som förut.
 */
async function deliverPending(market: Market): Promise<{ notified: number; notifyFailed: number }> {
  const pending = await prisma.notification.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - NOTIFY_RETRY_WINDOW_MS) },
      attempts: { lt: NOTIFY_MAX_ATTEMPTS },
      // Annonsen ska fortfarande gå att söka. En borttagen annons är ingen nyhet.
      listing: { market, active: true },
      watch: { enabled: true },
      OR: [
        { emailSent: false, watch: { notifyEmail: true } },
        { pushSent: false, watch: { notifyPush: true } },
      ],
    },
    include: { listing: true, watch: { include: { user: { include: { pushSubscriptions: true } } } } },
    orderBy: { createdAt: "asc" },
    take: NOTIFY_BATCH,
  });
  if (!pending.length) return { notified: 0, notifyFailed: 0 };

  // En bevakning i taget: alla dess annonser ryms i samma mail och samma push.
  const byWatch = new Map<string, typeof pending>();
  for (const n of pending) {
    const list = byWatch.get(n.watchId);
    if (list) list.push(n);
    else byWatch.set(n.watchId, [n]);
  }

  let notified = 0;
  let notifyFailed = 0;
  for (const group of byWatch.values()) {
    const { watch } = group[0];
    const ids = group.map((n) => n.id);

    // Har Pron hunnit löpa ut sedan notisen skrevs ned skickas den inte. Försöken
    // skruvas upp till taket så att raden lämnar leveranskön direkt.
    if (!hasPro(watch.user)) {
      await prisma.notification.updateMany({
        where: { id: { in: ids } },
        data: { attempts: NOTIFY_MAX_ATTEMPTS, lastTriedAt: new Date(), emailError: "Utan Pro", pushError: "Utan Pro" },
      });
      continue;
    }

    // Kanalerna hålls isär: gick mailet fram men inte pushen ska annonsen inte
    // följa med i nästa mail en gång till.
    const needEmail = watch.notifyEmail ? group.filter((n) => !n.emailSent) : [];
    const needPush = watch.notifyPush ? group.filter((n) => !n.pushSent) : [];
    const email: DeliveryResult | null = needEmail.length
      ? await sendWatchEmail(watch.user.email, watch, needEmail.map((n) => n.listing), watch.user.locale)
      : null;
    const push: DeliveryResult | null = needPush.length
      ? await sendWatchPush(watch.user.pushSubscriptions, watch, needPush.map((n) => n.listing), watch.user.locale)
      : null;

    if (email) {
      await prisma.notification.updateMany({
        where: { id: { in: needEmail.map((n) => n.id) } },
        data: { emailSent: email.ok, emailError: email.error },
      });
    }
    if (push) {
      await prisma.notification.updateMany({
        where: { id: { in: needPush.map((n) => n.id) } },
        data: { pushSent: push.ok, pushError: push.error },
      });
    }
    await prisma.notification.updateMany({ where: { id: { in: ids } }, data: { attempts: { increment: 1 }, lastTriedAt: new Date() } });

    // Räknas per annons och bara för det som hände nu: gick någon begärd kanal fram
    // är användaren nådd, annars är notisen fortfarande skyldig.
    const emailIds = new Set(needEmail.map((n) => n.id));
    const pushIds = new Set(needPush.map((n) => n.id));
    for (const n of group) {
      if ((email?.ok && emailIds.has(n.id)) || (push?.ok && pushIds.has(n.id))) notified += 1;
      else if ((email && emailIds.has(n.id)) || (push && pushIds.has(n.id))) notifyFailed += 1;
    }
  }

  if (notifyFailed) console.error(`[poll:${market}] ${notifyFailed} notiser gick inte att leverera`);
  return { notified, notifyFailed };
}

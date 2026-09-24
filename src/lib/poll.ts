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

/**
 * Hur stor andel av en kös aktiva annonser som får försvinna i **en** körning
 * innan avaktiveringen stoppas. Mellan två körningar försvinner i verkligheten en
 * handfull; att hälften gör det samtidigt är i praktiken alltid ett fel hos källan.
 *
 * Spärren mot helt tomma svar räckte inte. I september 2026 började HomeQ lämna ut
 * tio träffar i stället för alla – tio är inte noll, och varje körning avaktiverade
 * allt utom tio annonser. Den här spärren hade stoppat det, och den gäller alla
 * källor, också mot fel vi ännu inte sett.
 */
const MAX_DEACTIVATE_SHARE = 0.5;

/** Under så här många aktiva annonser gäller inte spärren: små köer svänger för mycket. */
const GUARD_MIN_ACTIVE = 20;

/**
 * Hur tidigt en kö får köras innan dess takt (`pollEveryMinutes`) har gått. GitHub
 * Actions schemalagda körningar kommer ofta ett kvarts timme sent, och ibland
 * inte alls. Utan marginalen skulle en försenad körning följd av en i tid göra
 * att en kö hoppas över i onödan.
 */
const POLL_SLACK_MS = 15 * 60_000;

/**
 * Avaktiveringen stoppades av spärren. Allt annat i körningen – nya annonser,
 * uppdateringar och notiser – har redan gått igenom och är bokfört, så felet ska
 * inte skriva över körningsraden igen.
 */
class DeactivationBlocked extends Error {}

export interface MarketPollResult {
  market: Market;
  total: number;
  newCount: number;
  updated: number;
  deactivated: number;
  /** Gamla, borttagna annonser som städades bort. */
  pruned: number;
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
  /**
   * Manuell körning (knappen i adminportalen, `npm run poll`). Kör alla köer
   * oavsett takt, och godkänner en avaktivering som spärren annars stoppat –
   * den som trycker har tittat på källan.
   */
  force?: boolean;
}

export interface PollResult {
  total: number;
  newCount: number;
  updated: number;
  deactivated: number;
  pruned: number;
  notified: number;
  notifyFailed: number;
  runId: string;
  markets: MarketPollResult[];
  /** Förmedlingar som inte gick att hämta, med felmeddelande */
  failed: { market: Market; error: string }[];
  /** Förmedlingar som hoppades över för att tiden tog slut; de tas nästa körning. */
  skipped: Market[];
  /** Köer som inte stod på tur än, enligt sin `pollEveryMinutes`. */
  notDue: Market[];
}

/**
 * Står kön på tur? Räknas från senaste **lyckade** körning: misslyckades den
 * förra ska nästa tillfälle användas, inte vänta ut en hel period.
 */
async function isDue(market: Market): Promise<boolean> {
  const last = await prisma.pollRun.findFirst({
    where: { market, ok: true },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  if (!last) return true;
  return Date.now() - last.startedAt.getTime() >= marketInfo(market).pollEveryMinutes * 60_000 - POLL_SLACK_MS;
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
  const wanted = options.market ? [options.market] : [...MARKETS];
  const runEnd = options.deadline ?? Date.now() + DEFAULT_RUN_MS;
  const markets: MarketPollResult[] = [];
  const failed: { market: Market; error: string }[] = [];
  const skipped: Market[] = [];

  // Varje kö har sin egen takt. Cron-jobbet anropar ändå var 30:e minut, och en kö
  // som inte står på tur kostar bara frågan om när den senast kördes.
  const due = options.force ? wanted.map(() => true) : await Promise.all(wanted.map(isDue));
  const todo = wanted.filter((_, i) => due[i]);
  const notDue = wanted.filter((_, i) => !due[i]);

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
      markets.push(await runMarketPoll(market, deadline, options.force));
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
    pruned: sum((m) => m.pruned),
    notified: sum((m) => m.notified),
    notifyFailed: sum((m) => m.notifyFailed),
    runId: markets[markets.length - 1]?.runId ?? "",
    markets,
    failed,
    skipped,
    notDue,
  };
}

/**
 * Hämtar en förmedlings annonser, sparar nya, uppdaterar ändrade, avaktiverar
 * borttagna och notifierar bevakningar som matchar de nya annonserna.
 */
export async function runMarketPoll(
  market: Market,
  deadline = Date.now() + DEFAULT_RUN_MS - WRITE_RESERVE_MS,
  force = false,
): Promise<MarketPollResult> {
  const run = await prisma.pollRun.create({ data: { market } });
  try {
    // Bildlistorna följer medvetet **inte** med här. De är den överlägset tyngsta
    // kolumnen – ett halvdussin adresser per annons – och allt vi behöver av dem i
    // det här läget är ja eller nej. Med några tusen annonser blev det megabyte
    // från databasen vid varje körning, för en boolean. Vilka som har bilder
    // hämtas som en ren id-lista i stället.
    // Bara de **aktiva** annonserna läses i sin helhet. Borttagna ligger kvar i
    // tabellen i 90 dagar innan de gallras, och hos en rikstäckande källa blir de
    // snabbt fler än de aktiva – HomeQ tappar runt tusen om dygnet. Att läsa alla
    // deras kolumner varje halvtimme var en växande post i Neons datatrafik, för
    // uppgifter som inte används. Av de inaktiva behövs bara id:t: en annons som
    // dyker upp igen ska kännas igen och inte notifieras som ny en gång till.
    //
    // Bildlistorna följer inte heller med. Allt vi behöver av dem här är ja eller
    // nej, så vilka som har bilder hämtas som en ren id-lista.
    const [existing, inactive, withImages] = await Promise.all([
      prisma.listing.findMany({
        where: { market, active: true },
        select: {
          id: true, refreshedAt: true, kotidQ1: true, kotidQ3: true, kotidSnitt: true, sokande: true,
          hyra: true, annonseradTill: true, vaning: true, yta: true, antalRum: true, active: true,
          imagesCheckedAt: true, queueDates: true, queueDatesAt: true,
        },
      }),
      prisma.listing.findMany({ where: { market, active: false }, select: { id: true } }),
      prisma.listing.findMany({ where: { market, active: true, images: { isEmpty: false } }, select: { id: true } }),
    ]);
    const existingById = new Map(existing.map((e) => [e.id, e]));
    const inactiveIds = new Set(inactive.map((r) => r.id));
    const hasImages = new Set(withImages.map((r) => r.id));
    const isFirstRun = existing.length === 0 && inactiveIds.size === 0;

    const known: Map<string, KnownListing> = new Map(
      existing.map((e) => [
        e.id,
        {
          refreshedAt: e.refreshedAt,
          kotidSnitt: e.kotidSnitt,
          hasImages: hasImages.has(e.id),
          imagesCheckedAt: e.imagesCheckedAt,
          queueDatesAt: e.queueDatesAt,
        },
      ]),
    );
    const { activeIds, listings } = await SOURCES[market].fetchListings(known, deadline);
    // Ett tomt svar är nästan alltid ett fel hos källan, inte en tom bostadskö.
    // Utan den här spärren hade en sådan körning avaktiverat allt vi har.
    if (!activeIds.length) throw new Error(`${marketInfo(market).name} gav inga annonser`);

    // Spärren mot massavaktivering. Den stoppar bara avaktiveringen: nya annonser,
    // uppdateringar och notiser går igenom som vanligt, så att en misstänkt källa
    // inte samtidigt stänger av bevakningarna. Körningen markeras som misslyckad
    // längre ned, så att det syns i adminportalen.
    const activeSet = new Set(activeIds);
    const missing = existing.filter((e) => !activeSet.has(e.id)).length;
    const blocked = !force && existing.length >= GUARD_MIN_ACTIVE && missing > existing.length * MAX_DEACTIVATE_SHARE;
    const now = new Date();

    // Få frågor i stället för en per annons: serverless-funktioner har kort tidsgräns.
    const incomingNew = listings.filter((l) => !existingById.has(l.id) && !inactiveIds.has(l.id));
    if (incomingNew.length) {
      await prisma.listing.createMany({
        data: incomingNew.map((l) => ({ ...l, firstSeenAt: now, lastSeenAt: now, refreshedAt: now, active: true })),
        skipDuplicates: true,
      });
    }
    // En rikstäckande källa har tusentals aktiva annonser, och hela id-listan i en
    // enda IN-sats blir en fråga på hundratals kilobyte. Den delas därför upp.
    for (const ids of chunked(activeIds)) {
      await prisma.listing.updateMany({
        where: { id: { in: ids } },
        data: { lastSeenAt: now, active: true },
      });
    }

    // Bilderna jämförs bara för de annonser källan faktiskt hämtade om den här
    // körningen. För Stockholm och Väst är det en handfull, och då är det billigare
    // att fråga efter just dem än att bära med sig allas bildlistor genom hela
    // körningen. Källor som får bilderna gratis i listsvaret lämnar lika många id
    // som förut – men aldrig fler.
    const refetchedImages = listings.filter((l) => l.images !== undefined && existingById.has(l.id)).map((l) => l.id);
    const previousImages = new Map<string, string[]>();
    for (const ids of chunked(refetchedImages)) {
      const rows = await prisma.listing.findMany({ where: { id: { in: ids } }, select: { id: true, images: true } });
      for (const r of rows) previousImages.set(r.id, r.images);
    }

    // Befintliga annonser vars uppgifter ändrats (t.ex. kötidsstatistik, antal
    // sökande eller sista dag) uppdateras individuellt. Det är sällan, så det kostar lite.
    const changed = listings.filter((l) => {
      // En annons som tagits bort och nu dykt upp igen skrivs alltid om: vi har inte
      // läst hennes gamla uppgifter att jämföra med, och de kan ha ändrats sedan dess.
      if (inactiveIds.has(l.id)) return true;
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
        (l.images !== undefined && !sameImages(previousImages.get(l.id) ?? [], l.images)) ||
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
    for (const ids of chunked(unchangedIds)) {
      await prisma.listing.updateMany({ where: { id: { in: ids } }, data: { refreshedAt: now } });
    }

    // Annonser vi faktiskt försökt hämta bilder för, oavsett om det gav något.
    // Utan den här stämpeln skulle bildlösa annonser hämtas om i all evighet.
    const checkedIds = listings.filter((l) => l.images !== undefined).map((l) => l.id);
    for (const ids of chunked(checkedIds)) {
      await prisma.listing.updateMany({ where: { id: { in: ids } }, data: { imagesCheckedAt: now } });
    }
    // Samma sak för kötiderna: stämpeln styr när annonsen står på tur igen.
    const queueCheckedIds = listings.filter((l) => l.queueDates !== undefined).map((l) => l.id);
    for (const ids of chunked(queueCheckedIds)) {
      await prisma.listing.updateMany({ where: { id: { in: ids } }, data: { queueDatesAt: now } });
    }

    // Avaktiveringen går på tidsstämpeln i stället för på en NOT IN-lista med varje
    // aktivt id. Allt vi sett den här körningen har just fått `lastSeenAt = now`,
    // så det som ligger före är precis det som försvunnit hos förmedlingen. Måste
    // därför komma efter alla skrivningar ovan – det gör den.
    const { count: deactivated } = blocked
      ? { count: 0 }
      : await prisma.listing.updateMany({
          where: { market, active: true, lastSeenAt: { lt: now } },
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

    // Sist av allt: notiserna ska aldrig behöva vänta på städningen.
    const pruned = await pruneOldListings(market, now);

    const info = marketInfo(market);
    const blockedMessage = blocked
      ? `Avaktiveringen stoppades: ${missing} av ${existing.length} aktiva annonser saknas i svaret från ${info.name}. ` +
        `Det är nästan alltid ett fel hos källan. Kontrollera ${info.siteUrl}; stämmer borttagningen, godkänn den med ` +
        `"Hämta annonser nu" i adminportalen.`
      : null;
    await prisma.pollRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        ok: !blocked,
        error: blockedMessage,
        total: activeIds.length,
        newCount: newListings.length,
        notified,
        notifyFailed,
      },
    });
    if (blockedMessage) throw new DeactivationBlocked(blockedMessage);
    return {
      market,
      total: activeIds.length,
      newCount: newListings.length,
      updated: changed.length,
      deactivated,
      pruned,
      notified,
      notifyFailed,
      runId: run.id,
    };
  } catch (err) {
    // En stoppad avaktivering är redan bokförd med sina siffror; skriv inte över den.
    if (!(err instanceof DeactivationBlocked)) {
      await prisma.pollRun.update({
        where: { id: run.id },
        data: { finishedAt: new Date(), ok: false, error: (err as Error).message },
      });
    }
    throw err;
  }
}

/**
 * Hur många id som får plats i en enda `IN`-sats. Postgres klarar fler, men frågan
 * skickas som text: 5 000 id är ett par hundra kilobyte SQL per anrop, och det
 * betalar vi för både i nätverk och i Neons cpu-tid.
 */
const ID_CHUNK = 1_000;

function* chunked(ids: string[]): Generator<string[]> {
  for (let i = 0; i < ids.length; i += ID_CHUNK) yield ids.slice(i, i + ID_CHUNK);
}

/**
 * Hur länge en borttagen annons sparas innan den gallras bort. Den ligger kvar en
 * bra bit efter att den slutat vara sökbar: det är den som gör att en gammal notis
 * och en sparad favorit fortfarande går att öppna.
 */
const PRUNE_AFTER_DAYS = 90;

/**
 * Hur många rader en körning gallrar. Taket är med flit lågt: gallringen ska aldrig
 * kunna bli det som gör att en körning inte hinner klart. Med en körning varannan
 * halvtimme räcker det ändå till mångdubbelt mer än någon källa producerar.
 */
const PRUNE_BATCH = 500;

/**
 * Städar bort gamla, borttagna annonser. Utan den växer tabellen för alltid: en
 * rikstäckande källa lägger till drygt tusen annonser om dygnet, och Neons
 * gratisnivå tar slut på ett halvår.
 *
 * **Favoritmarkerade annonser gallras aldrig.** Raderingen tar med sig favoriter
 * och notishistorik via `onDelete: Cascade`, och en sparad favorit som tyst
 * försvinner är användarens data, inte vårt skräp. Notishistoriken får däremot
 * följa med: den är en logg, och annonsen den pekar på finns ändå inte kvar.
 */
async function pruneOldListings(market: Market, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - PRUNE_AFTER_DAYS * 86_400_000);
  const old = await prisma.listing.findMany({
    where: { market, active: false, lastSeenAt: { lt: cutoff }, favorites: { none: {} } },
    select: { id: true },
    take: PRUNE_BATCH,
  });
  if (!old.length) return 0;
  const { count } = await prisma.listing.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  return count;
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

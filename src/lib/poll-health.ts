/**
 * Hälsokontroll för pollningen: larmar **en gång** när en kö börjat krångla, en
 * gång när den fungerar igen, och när det schemalagda anropet slutat komma.
 *
 * Varför det behövs. Tidigare var det enda tecknet på ett fel att GitHub-jobbet
 * blev rött – och det blev rött i varje körning så länge felet satt kvar, alltså
 * ett mail varannan halvtimme utan att säga vad som var fel. Samtidigt syntes inte
 * det som faktiskt är tyst farligt: att schemat slutat köra över huvud taget.
 *
 * Nu går ansvaret isär:
 *
 * - **Källan krånglar** (förmedlingen svarar konstigt, spärren slår till): felet
 *   bokförs på körningsraden och larmas härifrån, med orsaken i klartext.
 * - **Kedjan är trasig** (Vercel nere, fel hemlighet, databasen svarar inte): då kan
 *   inget bokföras, cron-endpointen svarar 500 och GitHub-jobbet blir rött.
 * - **Schemat har stannat** (GitHub pausar schemalagda jobb i publika repon efter 60
 *   dagar utan aktivitet, och hoppar ibland över körningar): Vercels dagliga körning
 *   märker att det gått för länge sedan förra och larmar.
 *
 * Larmen skickas via `sendOpsAlert()`. Ett misslyckat larm får aldrig fälla själva
 * pollningen, så allt här fångar sina egna fel.
 */

import { prisma } from "@/lib/prisma";
import { sendOpsAlert } from "@/lib/notify";
import { marketInfo, type Market } from "@/lib/markets";
import { formatDateTime } from "@/lib/format";

/** Hur spärrens fel börjar. Hälsokontrollen känner igen det på den. */
export const DEACTIVATION_BLOCKED_PREFIX = "Avaktiveringen stoppades";

/**
 * Hur många misslyckade körningar i rad innan det larmas. Enstaka fel är vardag –
 * förmedlingarna är vanliga webbplatser som då och då svarar 5xx – och går över av
 * sig själva. Tre i rad är en och en halv timme för en förmedling, tre för HomeQ.
 */
const FAILURES_BEFORE_ALERT = 3;

/**
 * Hur länge det får gå mellan två körningar innan schemat räknas som stannat.
 * GitHub är ofta sen och hoppar ibland över en körning, men tre timmar utan en
 * enda är inte slarv längre.
 */
const SCHEDULE_STALE_MS = 3 * 60 * 60 * 1000;

const adminUrl = () => `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/admin`;

/**
 * Spärren larmar direkt: den behöver en människa, och väntar man tre körningar
 * har användarna sett utgångna annonser i en och en halv timme i onödan.
 */
const thresholdFor = (error: string | null) => (error?.startsWith(DEACTIVATION_BLOCKED_PREFIX) ? 1 : FAILURES_BEFORE_ALERT);

/** Antal misslyckade körningar i följd, räknat från början av listan. */
const streakOf = (runs: { ok: boolean }[]) => {
  const i = runs.findIndex((r) => r.ok);
  return i === -1 ? runs.length : i;
};

/**
 * Larmar om kön just passerat gränsen för misslyckade körningar, eller just
 * fungerat igen efter att ha larmat. Jämförelsen är `===`, inte `>=`: så skickas
 * exakt ett larm per incident, och ingen extra tabell behövs för att minnas det.
 */
export async function reportHealth(market: Market): Promise<void> {
  try {
    const runs = await prisma.pollRun.findMany({
      where: { market, finishedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: { ok: true, error: true, startedAt: true },
    });
    const [latest, previous] = runs;
    if (!latest) return;
    const name = marketInfo(market).name;

    if (!latest.ok) {
      const streak = streakOf(runs);
      if (streak !== thresholdFor(latest.error)) return;
      const blocked = latest.error?.startsWith(DEACTIVATION_BLOCKED_PREFIX);
      await sendOpsAlert({
        subject: blocked ? `${name}: avaktiveringen stoppades` : `${name}: pollningen misslyckas`,
        lines: [
          blocked
            ? "Spärren mot massavaktivering slog till. Annonserna ligger kvar som aktiva tills någon tittat."
            : `${streak} körningar i rad har misslyckats. Nya annonser kommer inte in för den här kön.`,
          `Felet: ${latest.error ?? "okänt"}`,
          "Du får ett nytt mail när kön fungerar igen.",
        ],
        link: adminUrl(),
      });
      return;
    }

    // Fungerar igen. Larma bara om den förra incidenten faktiskt larmades.
    if (previous && !previous.ok) {
      const earlier = runs.slice(1);
      if (streakOf(earlier) < thresholdFor(previous.error)) return;
      const n = streakOf(earlier);
      await sendOpsAlert({
        subject: `${name}: fungerar igen`,
        lines: [`Senaste körningen gick bra efter ${n} ${n === 1 ? "misslyckad körning" : "misslyckade körningar i rad"}.`],
        link: adminUrl(),
      });
    }
  } catch (err) {
    console.error(`[poll-health:${market}]`, (err as Error).message);
  }
}

/**
 * Har det schemalagda anropet slutat komma? Anropas av Vercels dagliga körning,
 * **innan** den själv kör – annars är den ju alltid den senaste.
 */
export async function checkScheduleAlive(): Promise<void> {
  try {
    const last = await prisma.pollRun.findFirst({ orderBy: { startedAt: "desc" }, select: { startedAt: true } });
    if (last && Date.now() - last.startedAt.getTime() < SCHEDULE_STALE_MS) return;
    await sendOpsAlert({
      subject: "Den schemalagda pollningen har stannat",
      lines: [
        last
          ? `Senaste körningen startade ${formatDateTime(last.startedAt, "sv")}. GitHub Actions ska anropa var 30:e minut.`
          : "Det finns ingen körning alls i loggen.",
        "Vanligaste orsaken: GitHub pausar schemalagda jobb i publika repon efter 60 dagar utan aktivitet. " +
          "Starta om det under Actions → Poll bostadsförmedlingarna → Enable workflow.",
        "Den här dagliga körningen från Vercel håller annonserna någorlunda aktuella under tiden, men notiserna blir sena.",
      ],
      link: adminUrl(),
    });
  } catch (err) {
    console.error("[poll-health:schema]", (err as Error).message);
  }
}

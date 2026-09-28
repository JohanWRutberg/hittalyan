import { NextResponse, type NextRequest } from "next/server";
import { AllMarketsFailed, runPoll } from "@/lib/poll";
import { checkScheduleAlive } from "@/lib/poll-health";
import { isMarket, type Market } from "@/lib/markets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Marginal till `maxDuration`. Körningen avbryter sig själv i tid och svarar med
 * det den hann göra, i stället för att Vercel klipper anropet med 504.
 */
const RUN_BUDGET_MS = 40_000;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}` || req.nextUrl.searchParams.get("secret") === secret;
}

/**
 * `?market=<kod>` kör en enda förmedling, vilket är hur cron-jobbet anropar oss:
 * då får var och en hela funktionens tidsgräns för sig. Utan parameter körs alla
 * i tur och ordning, och de som inte hinns med hoppas över till nästa körning –
 * så anropar Vercels dagliga körning, som dessutom vaktar att schemat lever.
 *
 * **Statuskoden säger om kedjan fungerar, inte om källan gör det.**
 *
 * - 200: anropet gick fram och allt är bokfört – även om förmedlingen krånglade
 *   (`ok: false` i svaret). Det larmar hälsokontrollen om, en gång, med orsaken.
 * - 500: något i vår egen kedja gick sönder, så att felet inte ens kunde skrivas
 *   ned. Då är GitHub-jobbet det enda som kan säga ifrån, och det ska bli rött.
 *
 * Tidigare svarade ett fel hos Boplats Väst 500, och GitHub skickade ett mail om
 * misslyckat jobb varje halvtimme så länge felet satt kvar, utan orsak i mailet.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const param = req.nextUrl.searchParams.get("market");
  let market: Market | undefined;
  if (param !== null) {
    if (!isMarket(param)) {
      return NextResponse.json({ ok: false, error: `Okänd förmedling: ${param}` }, { status: 400 });
    }
    market = param;
  }
  // Vercels dagliga körning (utan kö) tittar först efter om GitHubs schema stannat.
  if (!market) await checkScheduleAlive();
  try {
    const result = await runPoll({ market, deadline: Date.now() + RUN_BUDGET_MS });
    return NextResponse.json({ ok: result.failed.length === 0, ...result });
  } catch (err) {
    console.error("[poll] misslyckades:", err);
    const recorded = err instanceof AllMarketsFailed && err.recorded;
    return NextResponse.json({ ok: false, recorded, error: (err as Error).message }, { status: recorded ? 200 : 500 });
  }
}

export const POST = GET;

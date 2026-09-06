import { NextResponse, type NextRequest } from "next/server";
import { runPoll } from "@/lib/poll";
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
 * i tur och ordning, och de som inte hinns med hoppas över till nästa körning.
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
  try {
    const result = await runPoll({ market, deadline: Date.now() + RUN_BUDGET_MS });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[poll] misslyckades:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export const POST = GET;

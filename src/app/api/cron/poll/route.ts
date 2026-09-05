import { NextResponse, type NextRequest } from "next/server";
import { runPoll } from "@/lib/poll";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}` || req.nextUrl.searchParams.get("secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runPoll();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[poll] misslyckades:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export const POST = GET;

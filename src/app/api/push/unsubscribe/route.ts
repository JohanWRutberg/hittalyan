import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: "endpoint saknas" }, { status: 400 });
  await prisma.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, userId: session.user.id } });
  return NextResponse.json({ ok: true });
}

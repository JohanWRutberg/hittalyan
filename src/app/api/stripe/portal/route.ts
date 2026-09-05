import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createPortalUrl, stripeConfigured } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  if (!stripeConfigured()) return NextResponse.redirect(new URL("/pro?status=unconfigured", req.url));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (!user.stripeCustomerId) return NextResponse.redirect(new URL("/pro?status=nocustomer", req.url), { status: 303 });
  try {
    return NextResponse.redirect(await createPortalUrl(user.stripeCustomerId), { status: 303 });
  } catch (err) {
    console.error("[stripe] portal:", err);
    return NextResponse.redirect(new URL("/pro?status=error", req.url), { status: 303 });
  }
}

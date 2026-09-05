import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createCheckoutUrl, stripeConfigured, type PriceKey } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  if (!stripeConfigured()) return NextResponse.redirect(new URL("/app/pro?status=unconfigured", req.url));
  const form = await req.formData();
  const key = String(form.get("price") ?? "") as PriceKey;
  if (!["monthly", "yearly", "pass"].includes(key)) return NextResponse.redirect(new URL("/app/pro?status=error", req.url));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  try {
    const url = await createCheckoutUrl(user, key);
    return NextResponse.redirect(url, { status: 303 });
  } catch (err) {
    console.error("[stripe] checkout:", err);
    return NextResponse.redirect(new URL("/app/pro?status=error", req.url), { status: 303 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isRenewing } from "@/lib/plan";
import { createCheckoutUrl, createPortalUrl, priceDefs, stripeConfigured, type PriceKey } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  if (!stripeConfigured()) return NextResponse.redirect(new URL("/pro?status=unconfigured", req.url));
  const form = await req.formData();
  const key = String(form.get("price") ?? "") as PriceKey;
  if (!["monthly", "yearly", "pass"].includes(key)) return NextResponse.redirect(new URL("/pro?status=error", req.url));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });

  // Har man redan en löpande prenumeration ska man **byta** plan, inte teckna en
  // till. Stripes checkout skapar annars en andra prenumeration vid sidan av den
  // första, båda debiterar, och webhooken skriver dessutom över
  // `stripeSubscriptionId` med den nya – så appen tappar bort den som fortfarande
  // drar pengar. Byten hör hemma i kundportalen, så dit går vi i stället.
  // Passet är undantaget: det är en engångsbetalning som lägger tid ovanpå.
  const def = priceDefs().find((p) => p.key === key);
  if (def?.mode === "subscription" && isRenewing(user) && user.stripeCustomerId) {
    try {
      return NextResponse.redirect(await createPortalUrl(user.stripeCustomerId), { status: 303 });
    } catch (err) {
      console.error("[stripe] portal (planbyte):", err);
      return NextResponse.redirect(new URL("/pro?status=error", req.url), { status: 303 });
    }
  }

  try {
    const url = await createCheckoutUrl(user, key);
    return NextResponse.redirect(url, { status: 303 });
  } catch (err) {
    console.error("[stripe] checkout:", err);
    return NextResponse.redirect(new URL("/pro?status=error", req.url), { status: 303 });
  }
}

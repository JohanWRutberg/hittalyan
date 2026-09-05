import { NextResponse, type NextRequest } from "next/server";
import { applyStripeEvent, stripe, stripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!stripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe är inte konfigurerat" }, { status: 503 });
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signatur saknas" }, { status: 400 });
  const body = await req.text();
  let event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: `Ogiltig signatur: ${(err as Error).message}` }, { status: 400 });
  }
  try {
    const result = await applyStripeEvent(event);
    console.log(`[stripe] ${event.type}: ${result}`);
    return NextResponse.json({ received: true, result });
  } catch (err) {
    console.error("[stripe] fel:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

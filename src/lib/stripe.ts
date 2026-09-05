import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

/**
 * Stripe: prenumeration (månad/år) eller engångspass (3 månader).
 * Priserna skapas i Stripe Dashboard och pekas ut via env.
 */

export type PriceKey = "monthly" | "yearly" | "pass";

export interface PriceDef {
  key: PriceKey;
  id: string | undefined;
  mode: "subscription" | "payment";
  title: string;
  amountLabel: string;
  period: string;
  description: string;
  /** Giltighet i månader för engångspass */
  passMonths?: number;
}

export function priceDefs(): PriceDef[] {
  return [
    {
      key: "monthly",
      id: process.env.STRIPE_PRICE_MONTHLY,
      mode: "subscription",
      title: "Månad",
      amountLabel: process.env.PRICE_LABEL_MONTHLY ?? "49 kr",
      period: "per månad",
      description: "Förnyas automatiskt, säg upp när du vill.",
    },
    {
      key: "pass",
      id: process.env.STRIPE_PRICE_PASS,
      mode: "payment",
      title: "3-månaderspass",
      amountLabel: process.env.PRICE_LABEL_PASS ?? "99 kr",
      period: "engångsbetalning",
      description: "Perfekt under en intensiv bostadsjakt. Ingen prenumeration.",
      passMonths: 3,
    },
    {
      key: "yearly",
      id: process.env.STRIPE_PRICE_YEARLY,
      mode: "subscription",
      title: "År",
      amountLabel: process.env.PRICE_LABEL_YEARLY ?? "299 kr",
      period: "per år",
      description: "Billigast per månad. Förnyas automatiskt.",
    },
  ];
}

export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY saknas");
  return (client ??= new Stripe(process.env.STRIPE_SECRET_KEY));
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Hämtar eller skapar Stripe-kund för användaren. */
export async function ensureCustomer(user: { id: string; email: string; name: string; stripeCustomerId: string | null }): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe().customers.create({ email: user.email, name: user.name, metadata: { userId: user.id } });
  await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export async function createCheckoutUrl(user: { id: string; email: string; name: string; stripeCustomerId: string | null }, key: PriceKey): Promise<string> {
  const def = priceDefs().find((p) => p.key === key);
  if (!def?.id) throw new Error("Priset är inte konfigurerat");
  const customer = await ensureCustomer(user);
  const session = await stripe().checkout.sessions.create({
    mode: def.mode,
    customer,
    client_reference_id: user.id,
    line_items: [{ price: def.id, quantity: 1 }],
    success_url: `${appUrl()}/app/pro?status=success`,
    cancel_url: `${appUrl()}/app/pro?status=cancel`,
    locale: "sv",
    allow_promotion_codes: true,
    metadata: { userId: user.id, priceKey: key },
    ...(def.mode === "payment" ? { invoice_creation: { enabled: true } } : {}),
  });
  if (!session.url) throw new Error("Stripe gav ingen checkout-URL");
  return session.url;
}

export async function createPortalUrl(customerId: string): Promise<string> {
  const session = await stripe().billingPortal.sessions.create({ customer: customerId, return_url: `${appUrl()}/app/pro` });
  return session.url;
}

// ---------- Webhook ----------

function periodEnd(sub: Stripe.Subscription): Date | null {
  // Från API-version 2025-03 ligger current_period_end på prenumerationsraden.
  const item = sub.items?.data?.[0] as { current_period_end?: number } | undefined;
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  const ts = item?.current_period_end ?? legacy;
  return ts ? new Date(ts * 1000) : null;
}

async function userForCustomer(customerId: string) {
  return prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
}

/**
 * Tillämpar en Stripe-händelse på databasen. Idempotent: samma event-id hanteras en gång.
 * Returnerar en kort beskrivning för loggning.
 */
export async function applyStripeEvent(event: Stripe.Event): Promise<string> {
  const seen = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
  if (seen) return `redan hanterad: ${event.type}`;
  await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      const userId = session.client_reference_id ?? session.metadata?.userId ?? null;
      const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : customerId ? await userForCustomer(customerId) : null;
      if (!user) return "checkout: ingen användare";
      if (session.mode === "payment") {
        const def = priceDefs().find((p) => p.key === session.metadata?.priceKey) ?? priceDefs().find((p) => p.mode === "payment");
        const months = def?.passMonths ?? 3;
        // Förläng från nuvarande slutdatum om Pro redan gäller, annars från nu
        const base = user.plan === "pro" && user.planExpiresAt && user.planExpiresAt > new Date() ? user.planExpiresAt : new Date();
        const expires = new Date(base);
        expires.setMonth(expires.getMonth() + months);
        await prisma.user.update({
          where: { id: user.id },
          data: { plan: "pro", planSource: "stripe", planExpiresAt: expires, stripeCustomerId: customerId ?? user.stripeCustomerId, stripePriceId: def?.id ?? null },
        });
        return `pass ${months} mån till ${user.email}`;
      }
      // Prenumeration: detaljerna kommer i customer.subscription.*; spara kund-id redan nu
      if (customerId && !user.stripeCustomerId) await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
      return `checkout (prenumeration) för ${user.email}`;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const user = await userForCustomer(customerId);
      if (!user) return `subscription: okänd kund ${customerId}`;
      const activeStatuses = new Set(["active", "trialing", "past_due"]);
      const end = periodEnd(sub);
      const isActive = activeStatuses.has(sub.status) && event.type !== "customer.subscription.deleted";
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeSubscriptionId: sub.id,
          stripeSubscriptionStatus: event.type === "customer.subscription.deleted" ? "canceled" : sub.status,
          stripePriceId: sub.items.data[0]?.price?.id ?? null,
          ...(isActive
            ? { plan: "pro", planSource: "stripe", planExpiresAt: end }
            : // Uppsagd/avslutad: Pro gäller till periodens slut (end), därefter free
              { plan: end && end > new Date() ? "pro" : "free", planSource: "stripe", planExpiresAt: end }),
        },
      });
      return `${event.type} ${sub.status} för ${user.email}`;
    }
    case "invoice.paid": {
      // Förnyelse: uppdatera slutdatum via prenumerationen
      const invoice = event.data.object;
      const subRef = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription
        ?? (invoice.parent?.subscription_details?.subscription as string | Stripe.Subscription | null | undefined);
      const subId = typeof subRef === "string" ? subRef : subRef?.id;
      if (!subId) return "invoice.paid utan prenumeration";
      const sub = await stripe().subscriptions.retrieve(subId);
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const user = await userForCustomer(customerId);
      if (!user) return "invoice.paid: okänd kund";
      await prisma.user.update({ where: { id: user.id }, data: { plan: "pro", planSource: "stripe", planExpiresAt: periodEnd(sub), stripeSubscriptionStatus: sub.status } });
      return `förnyelse för ${user.email}`;
    }
    default:
      return `ignorerad: ${event.type}`;
  }
}

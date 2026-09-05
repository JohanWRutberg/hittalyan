import type { Metadata } from "next";
import Link from "next/link";
import { Check, Crown, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { FREE_FEATURES, PRO_FEATURES, planInfo } from "@/lib/plan";
import { priceDefs, stripeConfigured } from "@/lib/stripe";
import { FadeIn } from "@/components/motion";

export const metadata: Metadata = { title: "Pro" };

const STATUS_TEXT: Record<string, { cls: string; text: string }> = {
  success: { cls: "border-brand-200 bg-brand-50 text-brand-900", text: "Tack! Betalningen är genomförd. Det kan ta några sekunder innan Pro syns här, ladda om sidan om det dröjer." },
  cancel: { cls: "border-line bg-white text-muted", text: "Köpet avbröts. Inget har debiterats." },
  error: { cls: "border-red-200 bg-red-50 text-red-800", text: "Något gick fel med betalningen. Försök igen eller kontakta oss." },
  unconfigured: { cls: "border-amber-200 bg-amber-50 text-amber-900", text: "Betalningar är inte aktiverade i den här miljön än." },
  required: { cls: "border-amber-200 bg-amber-50 text-amber-900", text: "Bevakningar är en Pro-funktion. Välj en plan nedan för att fortsätta." },
  nocustomer: { cls: "border-line bg-white text-muted", text: "Du har inget köp att hantera än." },
};

export default async function ProPage({ searchParams }: PageProps<"/app/pro">) {
  const sp = await searchParams;
  const session = await requireSession();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const info = planInfo(user);
  const prices = priceDefs();
  const status = typeof sp.status === "string" ? STATUS_TEXT[sp.status] : null;
  const canManage = user.stripeCustomerId && stripeConfigured();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hitta Lyan Pro</h1>
        <p className="mt-1 text-sm text-muted">Bevakningar med mail och push, så du aldrig missar en annons som matchar.</p>
      </div>

      {status && <FadeIn className={`rounded-2xl border px-4 py-3 text-sm ${status.cls}`}>{status.text}</FadeIn>}

      <FadeIn className={`card flex flex-wrap items-center justify-between gap-4 p-5 ${info.active ? "border-brand-200" : ""}`}>
        <div className="flex items-center gap-3">
          <span className={`grid size-10 place-items-center rounded-xl ${info.active ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"}`}>
            <Crown className="size-5" />
          </span>
          <div>
            <p className="font-semibold">
              Din plan: <span className={info.active ? "text-brand-700" : ""}>{info.label}</span>
            </p>
            <p className="text-sm text-muted">{info.detail}</p>
          </div>
        </div>
        {canManage && (
          <form action="/api/stripe/portal" method="post">
            <button type="submit" className="btn-secondary">Hantera betalning</button>
          </form>
        )}
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-3">
        {prices.map((p, i) => {
          const highlight = p.key === "pass";
          return (
            <FadeIn key={p.key} delay={0.05 * i} className={`card relative flex flex-col p-6 ${highlight ? "border-brand-300 ring-4 ring-brand-100" : ""}`}>
              {highlight && (
                <span className="absolute -top-3 left-6 chip border-brand-300 bg-brand-600 text-white">
                  <Sparkles className="size-3" /> Populärast
                </span>
              )}
              <h2 className="text-lg font-semibold">{p.title}</h2>
              <p className="mt-2 text-3xl font-bold tracking-tight">{p.amountLabel}</p>
              <p className="text-sm text-muted">{p.period}</p>
              <p className="mt-3 flex-1 text-sm text-muted">{p.description}</p>
              <form action="/api/stripe/checkout" method="post" className="mt-5">
                <input type="hidden" name="price" value={p.key} />
                <button type="submit" disabled={!p.id || !stripeConfigured()} className={`w-full ${highlight ? "btn-primary" : "btn-secondary"}`}>
                  {info.active && info.source !== "trial" ? "Förläng" : "Välj"}
                </button>
              </form>
            </FadeIn>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FadeIn delay={0.15} className="card p-6">
          <h3 className="font-semibold">Ingår i Pro</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand-600" /> {f}</li>
            ))}
          </ul>
        </FadeIn>
        <FadeIn delay={0.2} className="card p-6">
          <h3 className="font-semibold">Alltid gratis</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-slate-400" /> {f}</li>
            ))}
          </ul>
        </FadeIn>
      </div>

      <p className="text-xs text-muted">
        Betalningen hanteras av Stripe. Prenumerationer förnyas automatiskt tills du säger upp dem under “Hantera betalning”. Pass är en engångsbetalning och förnyas inte.{" "}
        <Link href="/app/bevakningar" className="text-brand-700 hover:underline">Till bevakningar</Link>
      </p>
    </div>
  );
}

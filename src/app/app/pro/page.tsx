import type { Metadata } from "next";
import Link from "next/link";
import { Check, Crown, Sparkles } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { describePlan, planState } from "@/lib/plan";
import { priceDefs, stripeConfigured } from "@/lib/stripe";
import { formatDate } from "@/lib/format";
import { FadeIn } from "@/components/motion";
import type { Locale } from "@/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.pages");
  return { title: t("pro") };
}

const STATUS_CLS: Record<string, string> = {
  success: "border-brand-200 bg-brand-50 text-brand-900",
  cancel: "border-line bg-white text-muted",
  error: "border-red-200 bg-red-50 text-red-800",
  unconfigured: "border-amber-200 bg-amber-50 text-amber-900",
  required: "border-amber-200 bg-amber-50 text-amber-900",
  nocustomer: "border-line bg-white text-muted",
};

export default async function ProPage({ searchParams }: PageProps<"/app/pro">) {
  const sp = await searchParams;
  const t = await getTranslations("pro");
  const locale = (await getLocale()) as Locale;
  const session = await requireSession();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const info = describePlan(planState(user), (k, v) => t(k, v), (d) => formatDate(d, locale));
  const prices = priceDefs();
  const statusKey = typeof sp.status === "string" && sp.status in STATUS_CLS ? sp.status : null;
  const canManage = user.stripeCustomerId && stripeConfigured();
  const proFeatures = t.raw("features.pro") as string[];
  const freeFeatures = t.raw("features.free") as string[];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("lead")}</p>
      </div>

      {statusKey && <FadeIn className={`rounded-2xl border px-4 py-3 text-sm ${STATUS_CLS[statusKey]}`}>{t(`status.${statusKey}`)}</FadeIn>}

      <FadeIn className={`card flex flex-wrap items-center justify-between gap-4 p-5 ${info.active ? "border-brand-200" : ""}`}>
        <div className="flex items-center gap-3">
          <span className={`grid size-10 place-items-center rounded-xl ${info.active ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"}`}>
            <Crown className="size-5" />
          </span>
          <div>
            <p className="font-semibold">
              {t("yourPlan")} <span className={info.active ? "text-brand-700" : ""}>{info.label}</span>
            </p>
            <p className="text-sm text-muted">{info.detail}</p>
          </div>
        </div>
        {canManage && (
          <form action="/api/stripe/portal" method="post">
            <button type="submit" className="btn-secondary">{t("manage")}</button>
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
                  <Sparkles className="size-3" /> {t("popular")}
                </span>
              )}
              <h2 className="text-lg font-semibold">{t(`prices.${p.key}.title`)}</h2>
              <p className="mt-2 text-3xl font-bold tracking-tight">{p.amountLabel}</p>
              <p className="text-sm text-muted">{t(`prices.${p.key}.period`)}</p>
              <p className="mt-3 flex-1 text-sm text-muted">{t(`prices.${p.key}.description`)}</p>
              <form action="/api/stripe/checkout" method="post" className="mt-5">
                <input type="hidden" name="price" value={p.key} />
                <button type="submit" disabled={!p.id || !stripeConfigured()} className={`w-full ${highlight ? "btn-primary" : "btn-secondary"}`}>
                  {info.active && info.source !== "trial" ? t("extend") : t("choose")}
                </button>
              </form>
            </FadeIn>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FadeIn delay={0.15} className="card p-6">
          <h3 className="font-semibold">{t("included")}</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {proFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand-600" /> {f}</li>
            ))}
          </ul>
        </FadeIn>
        <FadeIn delay={0.2} className="card p-6">
          <h3 className="font-semibold">{t("alwaysFree")}</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {freeFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-slate-400" /> {f}</li>
            ))}
          </ul>
        </FadeIn>
      </div>

      <p className="text-xs text-muted">
        {t("footer")}{" "}
        <Link href="/app/bevakningar" className="text-brand-700 hover:underline">{t("toWatches")}</Link>
      </p>
    </div>
  );
}

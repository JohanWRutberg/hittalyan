import Link from "next/link";
import { Bell, Filter, Mail, Clock3, ArrowRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { FadeIn } from "@/components/motion";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import { MARKETS, marketInfo } from "@/lib/markets";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const tc = await getTranslations("common");
  const locale = (await getLocale()) as Locale;
  const [session, activeCount, lastRun, perMarket] = await Promise.all([
    getSession(),
    prisma.listing.count({ where: { active: true } }),
    prisma.pollRun.findFirst({ where: { ok: true }, orderBy: { startedAt: "desc" } }),
    prisma.listing.groupBy({ by: ["market"], where: { active: true }, _count: { _all: true } }),
  ]);
  const activeByMarket = new Map(perMarket.map((r) => [r.market, r._count._all]));

  const features = [
    { icon: Filter, key: "filter" },
    { icon: Bell, key: "push" },
    { icon: Mail, key: "mail" },
    { icon: Clock3, key: "queue" },
  ] as const;

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <LocaleSwitcher compact />
          {session ? (
            <Link href="/lagenheter" className="btn-primary">
              {tc("toApp")} <ArrowRight className="size-4" />
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                {tc("login")}
              </Link>
              <Link href="/register" className="btn-primary">
                {tc("register")}
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24">
        <section className="relative overflow-hidden rounded-3xl border border-line bg-white px-6 py-16 shadow-soft sm:px-12 sm:py-24">
          <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-brand-100 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-sky-100 blur-3xl" />
          <FadeIn className="relative max-w-2xl">
            <span className="chip border-brand-200 bg-brand-50 text-brand-700">
              <span className="size-1.5 rounded-full bg-brand-500" /> {t("badge")}
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-ink sm:text-6xl">{t("title")}</h1>
            <p className="mt-5 text-lg text-muted">{t("lead")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={session ? "/lagenheter" : "/register"} className="btn-primary px-6 py-3 text-base">
                {t("cta")} <ArrowRight className="size-4" />
              </Link>
              <Link href="/lagenheter" className="btn-secondary px-6 py-3 text-base">
                {tc("viewListings")}
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted">
              {t.rich("activeNow", { count: formatNumber(activeCount, locale), strong: (c) => <strong className="text-ink">{c}</strong> })}
              {lastRun?.finishedAt && t("updatedAt", { time: formatDateTime(lastRun.finishedAt, locale) })}
            </p>
          </FadeIn>
        </section>

        <section className="mt-10">
          <FadeIn className="card p-6">
            <h2 className="text-lg font-semibold">{t("cities.title")}</h2>
            <p className="mt-1 text-sm text-muted">{t("cities.lead")}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {MARKETS.map((m) => {
                const info = marketInfo(m);
                return (
                  <div key={m} className="rounded-2xl border border-line bg-canvas px-4 py-3">
                    <p className="font-semibold">{info.city}</p>
                    <p className="truncate text-xs text-muted">{info.name}</p>
                    <p className="mt-1 text-sm text-brand-700">
                      {t.rich("activeNow", {
                        count: formatNumber(activeByMarket.get(m) ?? 0, locale),
                        strong: (c) => <strong>{c}</strong>,
                      })}
                    </p>
                  </div>
                );
              })}
            </div>
          </FadeIn>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <FadeIn key={f.key} delay={0.1 + i * 0.06} className="card p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{t(`features.${f.key}.title`)}</h3>
              <p className="mt-1 text-sm text-muted">{t(`features.${f.key}.text`)}</p>
            </FadeIn>
          ))}
        </section>
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-muted">{t("footer")}</footer>
    </div>
  );
}

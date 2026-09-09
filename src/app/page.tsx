import Link from "next/link";
import { Bell, Filter, Mail, Clock3, ArrowRight, LogIn } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { FadeIn } from "@/components/motion";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { SignOutButton } from "@/components/nav-client";
import { SiteFooter } from "@/components/site-footer";
import { SwedenMap } from "@/components/sweden-map";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatList, formatNumber } from "@/lib/format";
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
      {/*
        Sidhuvudet får plats på en telefon, och det kräver att något viker. Måtten
        vid 390 px: logotypen 115, temaväxlaren 88, språkväljaren 74 – bara
        växlarna tar alltså 162 px. Med "Logga in" som text (89) och "Skapa konto"
        (116) blev raden 566 px bred, och sidan gick att dra i sidled.
        Registreringsknappen är den som får stå över: den finns som stor knapp i
        hjältekortet strax under, medan inloggning inte finns någon annanstans.
      */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-5 sm:gap-3 sm:px-6">
        <Logo />
        <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeSwitcher compact />
          <LocaleSwitcher compact />
          {session ? (
            <SignOutButton />
          ) : (
            <>
              <Link href="/login" title={tc("login")} aria-label={tc("login")} className="btn-ghost px-2 sm:px-4">
                <LogIn className="size-4 sm:hidden" />
                <span className="hidden sm:inline">{tc("login")}</span>
              </Link>
              <Link href="/register" className="btn-primary hidden sm:inline-flex">
                {tc("register")}
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24">
        <section className="relative overflow-hidden rounded-3xl border border-line bg-surface px-6 py-16 shadow-soft sm:px-12 sm:py-24">
          <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-accent-soft blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-sky-100 blur-3xl dark:bg-sky-500/10" />
          <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
          <FadeIn className="max-w-2xl">
            <span className="chip border-accent-line bg-accent-soft text-accent">
              <span className="size-1.5 rounded-full bg-brand-500" /> {t("badge", { count: MARKETS.length })}
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-ink sm:text-6xl">{t("title")}</h1>
            {/* Namnen räknas upp ur MARKETS, så texten stämmer så fort en kö tillkommer. */}
            <p className="mt-5 text-lg text-muted">{t("lead", { sources: formatList(MARKETS.map((m) => marketInfo(m).name), locale) })}</p>
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
          <FadeIn delay={0.15} className="lg:w-[21rem]">
            <SwedenMap counts={Object.fromEntries(activeByMarket)} />
          </FadeIn>
          </div>
        </section>

        <section className="mt-10">
          <FadeIn className="card p-6">
            <h2 className="text-lg font-semibold">{t("cities.title", { count: MARKETS.length })}</h2>
            <p className="mt-1 text-sm text-muted">{t("cities.lead")}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {MARKETS.map((m) => {
                const info = marketInfo(m);
                return (
                  <div key={m} className="rounded-2xl border border-line bg-canvas px-4 py-3">
                    <p className="font-semibold">{info.short}</p>
                    {/* Boplats Väst och Syd heter redan sitt förmedlingsnamn i etiketten. */}
                    {info.name !== info.short && <p className="truncate text-xs text-muted">{info.name}</p>}
                    <p className="mt-1 text-sm text-accent">
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
              <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{t(`features.${f.key}.title`)}</h3>
              <p className="mt-1 text-sm text-muted">{t(`features.${f.key}.text`)}</p>
            </FadeIn>
          ))}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

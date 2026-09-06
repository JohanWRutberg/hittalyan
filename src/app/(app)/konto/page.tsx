import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CalendarClock, Mail, ShieldCheck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatDate, formatDateTime, formatNumber, queueTime } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import { PushToggle } from "@/components/push-toggle";
import { PushGuide } from "@/components/push-guide";
import { NameForm, QueueDateForm } from "@/components/account-forms";
import { MarketSwitcher } from "@/components/market-switcher";
import { getCurrentMarket, getQueueDate } from "@/lib/market-context";
import { marketInfo, marketOf } from "@/lib/markets";
import { EmailChangeForm } from "@/components/email-change-form";
import { FadeIn } from "@/components/motion";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.pages");
  return { title: t("account") };
}

export default async function AccountPage({ searchParams }: PageProps<"/konto">) {
  const t = await getTranslations("account");
  const tm = await getTranslations("markets");
  const locale = (await getLocale()) as Locale;
  const sp = await searchParams;
  const session = await requireSession();
  const market = await getCurrentMarket();
  const info = marketInfo(market);
  const [user, queueDate, notifications, pushCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id } }),
    getQueueDate(session.user.id, market),
    prisma.notification.findMany({
      where: { userId: session.user.id },
      include: { listing: true, watch: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.pushSubscription.count({ where: { userId: session.user.id } }),
  ]);
  const qt = queueDate ? queueTime(queueDate) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {sp.ny && (
        <FadeIn className="rounded-2xl border border-brand-200 bg-brand-50 p-5 text-brand-900">
          <p className="font-semibold">{t("welcome.title")}</p>
          <p className="mt-1 text-sm">
            {t.rich("welcome.lead", {
              link: (c) => (
                <Link href="/bevakningar/ny" className="font-semibold underline">
                  {c}
                </Link>
              ),
            })}
          </p>
        </FadeIn>
      )}

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{user.email}{user.role === "admin" && t("adminSuffix")}</p>
      </div>

      <FadeIn className="card p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><CalendarClock className="size-5" /></span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{t("queue.title")}</h2>
            <p className="text-sm text-muted">{info.name}</p>
            {qt ? (
              <p className="mt-1 text-3xl font-bold tracking-tight text-brand-700">
                {t("queue.value", { years: qt.years, days: qt.days })}
                <span className="mt-0.5 block text-sm font-medium text-muted sm:ml-2 sm:inline sm:text-base">
                  {t("queue.since", { total: formatNumber(qt.totalDays, locale), date: formatDate(queueDate, locale) })}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">{t("queue.missing", { source: info.name })}</p>
            )}
            <div className="mt-4">
              <QueueDateForm key={market} value={queueDate ? queueDate.toISOString().slice(0, 10) : ""} />
            </div>
            <p className="mt-3 text-xs text-muted">{t("queue.note")}</p>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.03} className="card p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Building2 className="size-5" /></span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{tm("accountTitle")}</h2>
            <p className="mt-1 text-sm text-muted">{tm("accountLead")}</p>
            <div className="mt-4"><MarketSwitcher current={market} /></div>
            <p className="mt-3 text-xs text-muted">{tm("accountNote")}</p>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.05} className="card p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><ShieldCheck className="size-5" /></span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{t("notifications.title")}</h2>
            <p className="mt-1 text-sm text-muted">
              {t("notifications.lead")} {pushCount > 0 ? t("notifications.enabledOn", { count: pushCount }) : t("notifications.none")}
            </p>
            <div className="mt-4"><PushToggle /></div>
            <details className="mt-4 group">
              <summary className="cursor-pointer text-sm font-medium text-brand-700 hover:underline">{t("notifications.guide")}</summary>
              <div className="mt-3"><PushGuide variant="full" /></div>
            </details>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.1} className="card p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Mail className="size-5" /></span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{t("profile.title")}</h2>
            <div className="mt-4"><NameForm value={user.name} /></div>
            <div className="mt-6 border-t border-line pt-5">
              <h3 className="font-semibold">{t("email.title")}</h3>
              <div className="mt-3"><EmailChangeForm current={user.email} /></div>
            </div>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.15} className="card overflow-hidden">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-lg font-semibold">{t("history.title")}</h2>
          <p className="text-sm text-muted">{t("history.lead")}</p>
        </div>
        {notifications.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted">{t("history.empty")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-4 px-6 py-3 text-sm">
                <div className="min-w-0">
                  <a href={n.listing.url} target="_blank" rel="noreferrer" className="truncate font-medium text-brand-700 hover:underline">
                    {n.listing.gatuadress}, {n.listing.stadsdel}
                  </a>
                  <p className="text-xs text-muted">{n.watch.name} · {marketInfo(marketOf(n.listing.market)).city} · {formatDateTime(n.createdAt, locale)}</p>
                </div>
                <div className="flex shrink-0 gap-1.5 text-xs text-muted">
                  {n.emailSent && <span className="chip">{t("history.mail")}</span>}
                  {n.pushSent && <span className="chip">{t("history.push")}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </FadeIn>
    </div>
  );
}

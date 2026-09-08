import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { dayAgo, formatDate, formatDateTime } from "@/lib/format";
import { RunPollButton, UserActions } from "@/components/admin-client";
import { FadeIn } from "@/components/motion";
import { describePlan, planState } from "@/lib/plan";
import type { Locale } from "@/i18n/config";
import { MARKETS, marketInfo, marketOf } from "@/lib/markets";

/**
 * Knappen "kör hämtning" anropar runPoll() som en server action, alltså mot den
 * här sidans route. En hel körning tar 20–25 sekunder sedan bildhämtningen kom
 * till, vilket är mer än Vercels standardgräns – därför samma 60 sekunder som
 * cron-endpointen.
 */
export const maxDuration = 60;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.pages");
  return { title: t("admin") };
}

export default async function AdminPage() {
  const t = await getTranslations("admin");
  const tPro = await getTranslations("pro");
  const locale = (await getLocale()) as Locale;
  const session = await requireSession();
  if (session.user.role !== "admin") redirect("/lagenheter");

  const [users, runs, stats, perMarket] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        queues: { select: { market: true, registeredAt: true } },
        _count: { select: { watches: true, notifications: true, pushSubscriptions: true } },
      },
    }),
    // Fyra förmedlingar per körning, så listan behöver rymma några omgångar.
    prisma.pollRun.findMany({ orderBy: { startedAt: "desc" }, take: 24 }),
    Promise.all([
      prisma.listing.count({ where: { active: true } }),
      prisma.listing.count(),
      prisma.watch.count({ where: { enabled: true } }),
      prisma.notification.count(),
      // Notiser från det senaste dygnet som utlovats men ännu inte gått fram. Ska
      // normalt vara noll; är den det inte ligger felet i mailet eller pushen, inte
      // i hämtningen. Äldre än ett dygn försöks inte om och räknas därför inte.
      prisma.notification.count({
        where: {
          createdAt: { gte: dayAgo() },
          OR: [
            { emailSent: false, watch: { notifyEmail: true } },
            { pushSent: false, watch: { notifyPush: true } },
          ],
        },
      }),
    ]),
    prisma.listing.groupBy({ by: ["market"], where: { active: true }, _count: { _all: true } }),
  ]);
  const [active, totalListings, activeWatches, sentNotifications, pendingNotifications] = stats;
  const activeByMarket = new Map(perMarket.map((r) => [r.market, r._count._all]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("lead")}</p>
        </div>
        <RunPollButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          [t("stats.active"), active, false],
          [t("stats.total"), totalListings, false],
          [t("stats.watches"), activeWatches, false],
          [t("stats.sent"), sentNotifications, false],
          [t("stats.pending"), pendingNotifications, pendingNotifications > 0],
        ].map(([label, value, warn], i) => (
          <FadeIn key={String(label)} delay={i * 0.04} className={`card p-5 ${warn ? "border-danger-line bg-danger-soft/50" : ""}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
            <p className={`mt-1 text-3xl font-bold tracking-tight ${warn ? "text-danger" : ""}`}>{String(value)}</p>
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={0.12} className="card p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("stats.perMarket")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MARKETS.map((m) => (
            <span key={m} className="chip" title={marketInfo(m).name}>
              {marketInfo(m).short} · {activeByMarket.get(m) ?? 0}
            </span>
          ))}
        </div>
      </FadeIn>

      <FadeIn delay={0.15} className="card overflow-hidden">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-lg font-semibold">{t("users.title", { count: users.length })}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-6 py-3">{t("users.user")}</th>
                <th className="px-3 py-3">{t("users.role")}</th>
                <th className="px-3 py-3">{t("users.status")}</th>
                <th className="px-3 py-3">{t("users.plan")}</th>
                <th className="px-3 py-3">{t("users.market")}</th>
                <th className="px-3 py-3">{t("users.queueDate")}</th>
                <th className="px-3 py-3 text-right">{t("users.watches")}</th>
                <th className="px-3 py-3 text-right">{t("users.notifications")}</th>
                <th className="px-3 py-3 text-right">{t("users.push")}</th>
                <th className="px-3 py-3">{t("users.created")}</th>
                <th className="px-6 py-3 text-right">{t("users.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => (
                <tr key={u.id} className={u.banned ? "bg-danger-soft/50" : ""}>
                  <td className="px-6 py-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted">{u.email}</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`chip ${u.role === "admin" ? "border-accent-line bg-accent-soft text-accent" : ""}`}>{u.role ?? "user"}</span>
                  </td>
                  <td className="px-3 py-3">
                    {u.banned ? <span className="chip border-danger-line bg-danger-soft text-danger" title={u.banReason ?? ""}>{t("users.banned")}</span> : <span className="chip">{t("users.active")}</span>}
                  </td>
                  <td className="px-3 py-3">
                    {(() => {
                      const pi = describePlan(planState(u), (k, v) => tPro(k, v), (d) => formatDate(d, locale));
                      return (
                        <span className={`chip ${pi.active ? "border-warn-line bg-warn-soft text-warn" : ""}`} title={pi.detail}>
                          {pi.label}
                          {pi.expiresAt && pi.active && <span className="font-normal text-muted">· {formatDate(pi.expiresAt, locale)}</span>}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-3 text-muted">{marketInfo(marketOf(u.market)).short}</td>
                  <td className="px-3 py-3 text-muted">
                    {(() => {
                      // Kötiden gäller den kö användaren står i just nu.
                      const q = u.queues.find((x) => x.market === u.market);
                      return q ? formatDate(q.registeredAt, locale) : "–";
                    })()}
                  </td>
                  <td className="px-3 py-3 text-right">{u._count.watches}</td>
                  <td className="px-3 py-3 text-right">{u._count.notifications}</td>
                  <td className="px-3 py-3 text-right">{u._count.pushSubscriptions}</td>
                  <td className="px-3 py-3 text-muted">{formatDate(u.createdAt, locale)}</td>
                  <td className="px-6 py-3">
                    <UserActions user={{ id: u.id, name: u.name, role: u.role, banned: u.banned, plan: planState(u).active && u.role !== "admin" ? "pro" : u.plan === "pro" ? "pro" : "free" }} isSelf={u.id === session.user.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FadeIn>

      <FadeIn delay={0.2} className="card overflow-hidden">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-lg font-semibold">{t("runs.title")}</h2>
          <p className="text-sm text-muted">{t("runs.lead")}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-6 py-3">{t("runs.started")}</th>
                <th className="px-3 py-3">{t("users.market")}</th>
                <th className="px-3 py-3">{t("users.status")}</th>
                <th className="px-3 py-3 text-right">{t("runs.listings")}</th>
                <th className="px-3 py-3 text-right">{t("runs.new")}</th>
                <th className="px-3 py-3 text-right">{t("users.notifications")}</th>
                <th className="px-3 py-3 text-right">{t("runs.undelivered")}</th>
                <th className="px-6 py-3">{t("runs.error")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {runs.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-6 text-center text-muted">{t("runs.none")}</td></tr>
              )}
              {runs.map((r) => (
                <tr key={r.id} className={r.finishedAt && !r.ok ? "bg-danger-soft/50" : ""}>
                  <td className="px-6 py-3">{formatDateTime(r.startedAt, locale)}</td>
                  <td className="px-3 py-3">{marketInfo(marketOf(r.market)).short}</td>
                  <td className="px-3 py-3">{!r.finishedAt ? t("runs.running") : r.ok ? t("runs.ok") : t("runs.failed")}</td>
                  <td className="px-3 py-3 text-right">{r.total}</td>
                  <td className="px-3 py-3 text-right">{r.newCount}</td>
                  <td className="px-3 py-3 text-right">{r.notified}</td>
                  <td className={`px-3 py-3 text-right ${r.notifyFailed ? "font-semibold text-danger" : ""}`}>{r.notifyFailed}</td>
                  <td className="px-6 py-3 text-xs text-danger">{r.error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FadeIn>
    </div>
  );
}

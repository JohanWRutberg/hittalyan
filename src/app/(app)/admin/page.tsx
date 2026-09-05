import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/format";
import { RunPollButton, UserActions } from "@/components/admin-client";
import { FadeIn } from "@/components/motion";
import { describePlan, planState } from "@/lib/plan";
import type { Locale } from "@/i18n/config";

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

  const [users, runs, stats] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { watches: true, notifications: true, pushSubscriptions: true } } },
    }),
    prisma.pollRun.findMany({ orderBy: { startedAt: "desc" }, take: 12 }),
    Promise.all([
      prisma.listing.count({ where: { active: true } }),
      prisma.listing.count(),
      prisma.watch.count({ where: { enabled: true } }),
      prisma.notification.count(),
    ]),
  ]);
  const [active, totalListings, activeWatches, sentNotifications] = stats;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("lead")}</p>
        </div>
        <RunPollButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          [t("stats.active"), active],
          [t("stats.total"), totalListings],
          [t("stats.watches"), activeWatches],
          [t("stats.sent"), sentNotifications],
        ].map(([label, value], i) => (
          <FadeIn key={String(label)} delay={i * 0.04} className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
          </FadeIn>
        ))}
      </div>

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
                <tr key={u.id} className={u.banned ? "bg-red-50/50" : ""}>
                  <td className="px-6 py-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted">{u.email}</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`chip ${u.role === "admin" ? "border-brand-200 bg-brand-50 text-brand-700" : ""}`}>{u.role ?? "user"}</span>
                  </td>
                  <td className="px-3 py-3">
                    {u.banned ? <span className="chip border-red-200 bg-red-50 text-red-700" title={u.banReason ?? ""}>{t("users.banned")}</span> : <span className="chip">{t("users.active")}</span>}
                  </td>
                  <td className="px-3 py-3">
                    {(() => {
                      const pi = describePlan(planState(u), (k, v) => tPro(k, v), (d) => formatDate(d, locale));
                      return (
                        <span className={`chip ${pi.active ? "border-amber-200 bg-amber-50 text-amber-800" : ""}`} title={pi.detail}>
                          {pi.label}
                          {pi.expiresAt && pi.active && <span className="font-normal text-muted">· {formatDate(pi.expiresAt, locale)}</span>}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-3 text-muted">{u.queueRegisteredAt ? formatDate(u.queueRegisteredAt, locale) : "–"}</td>
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
                <th className="px-3 py-3">{t("users.status")}</th>
                <th className="px-3 py-3 text-right">{t("runs.listings")}</th>
                <th className="px-3 py-3 text-right">{t("runs.new")}</th>
                <th className="px-3 py-3 text-right">{t("users.notifications")}</th>
                <th className="px-6 py-3">{t("runs.error")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {runs.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-6 text-center text-muted">{t("runs.none")}</td></tr>
              )}
              {runs.map((r) => (
                <tr key={r.id} className={r.finishedAt && !r.ok ? "bg-red-50/50" : ""}>
                  <td className="px-6 py-3">{formatDateTime(r.startedAt, locale)}</td>
                  <td className="px-3 py-3">{!r.finishedAt ? t("runs.running") : r.ok ? t("runs.ok") : t("runs.failed")}</td>
                  <td className="px-3 py-3 text-right">{r.total}</td>
                  <td className="px-3 py-3 text-right">{r.newCount}</td>
                  <td className="px-3 py-3 text-right">{r.notified}</td>
                  <td className="px-6 py-3 text-xs text-red-700">{r.error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FadeIn>
    </div>
  );
}

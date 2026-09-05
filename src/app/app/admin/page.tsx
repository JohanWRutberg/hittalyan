import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/format";
import { RunPollButton, UserActions } from "@/components/admin-client";
import { FadeIn } from "@/components/motion";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const session = await requireSession();
  if (session.user.role !== "admin") redirect("/app");

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
          <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
          <p className="mt-1 text-sm text-muted">Användare, körningar och systemstatus.</p>
        </div>
        <RunPollButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Aktiva annonser", active],
          ["Annonser totalt", totalListings],
          ["Aktiva bevakningar", activeWatches],
          ["Skickade notiser", sentNotifications],
        ].map(([label, value], i) => (
          <FadeIn key={String(label)} delay={i * 0.04} className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={0.15} className="card overflow-hidden">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-lg font-semibold">Användare ({users.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-6 py-3">Användare</th>
                <th className="px-3 py-3">Roll</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Ködatum</th>
                <th className="px-3 py-3 text-right">Bevakn.</th>
                <th className="px-3 py-3 text-right">Notiser</th>
                <th className="px-3 py-3 text-right">Push</th>
                <th className="px-3 py-3">Skapad</th>
                <th className="px-6 py-3 text-right">Åtgärder</th>
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
                    {u.banned ? <span className="chip border-red-200 bg-red-50 text-red-700" title={u.banReason ?? ""}>Avstängd</span> : <span className="chip">Aktiv</span>}
                  </td>
                  <td className="px-3 py-3 text-muted">{u.queueRegisteredAt ? formatDate(u.queueRegisteredAt) : "–"}</td>
                  <td className="px-3 py-3 text-right">{u._count.watches}</td>
                  <td className="px-3 py-3 text-right">{u._count.notifications}</td>
                  <td className="px-3 py-3 text-right">{u._count.pushSubscriptions}</td>
                  <td className="px-3 py-3 text-muted">{formatDate(u.createdAt)}</td>
                  <td className="px-6 py-3">
                    <UserActions user={{ id: u.id, name: u.name, role: u.role, banned: u.banned }} isSelf={u.id === session.user.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FadeIn>

      <FadeIn delay={0.2} className="card overflow-hidden">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-lg font-semibold">Senaste hämtningar</h2>
          <p className="text-sm text-muted">Körs varje timme via cron. Röd rad = fel.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-6 py-3">Startad</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Annonser</th>
                <th className="px-3 py-3 text-right">Nya</th>
                <th className="px-3 py-3 text-right">Notiser</th>
                <th className="px-6 py-3">Fel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {runs.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-6 text-center text-muted">Ingen körning än.</td></tr>
              )}
              {runs.map((r) => (
                <tr key={r.id} className={r.finishedAt && !r.ok ? "bg-red-50/50" : ""}>
                  <td className="px-6 py-3">{formatDateTime(r.startedAt)}</td>
                  <td className="px-3 py-3">{!r.finishedAt ? "Pågår" : r.ok ? "OK" : "Fel"}</td>
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

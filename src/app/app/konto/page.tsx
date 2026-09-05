import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Mail, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatDate, formatDateTime, queueTime } from "@/lib/format";
import { PushToggle } from "@/components/push-toggle";
import { NameForm, QueueDateForm } from "@/components/account-forms";
import { FadeIn } from "@/components/motion";

export const metadata: Metadata = { title: "Konto" };

export default async function AccountPage({ searchParams }: PageProps<"/app/konto">) {
  const sp = await searchParams;
  const session = await requireSession();
  const [user, notifications, pushCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id } }),
    prisma.notification.findMany({
      where: { userId: session.user.id },
      include: { listing: true, watch: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.pushSubscription.count({ where: { userId: session.user.id } }),
  ]);
  const qt = user.queueRegisteredAt ? queueTime(user.queueRegisteredAt) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {sp.ny && (
        <FadeIn className="rounded-2xl border border-brand-200 bg-brand-50 p-5 text-brand-900">
          <p className="font-semibold">Välkommen till Ledigt!</p>
          <p className="mt-1 text-sm">
            Tre snabba steg: ange ditt ködatum nedan, aktivera notiser, och{" "}
            <Link href="/app/bevakningar/ny" className="font-semibold underline">skapa din första bevakning</Link>.
          </p>
        </FadeIn>
      )}

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Konto</h1>
        <p className="mt-1 text-sm text-muted">{user.email}{user.role === "admin" && " · administratör"}</p>
      </div>

      <FadeIn className="card p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><CalendarClock className="size-5" /></span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Din kötid hos Bostadsförmedlingen</h2>
            {qt ? (
              <p className="mt-1 text-3xl font-bold tracking-tight text-brand-700">
                {qt.years} år {qt.days} {qt.days === 1 ? "dag" : "dagar"}
                <span className="ml-2 text-base font-medium text-muted">({qt.totalDays} dagar sedan {formatDate(user.queueRegisteredAt)})</span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">Ange datumet du registrerade dig i bostadskön så räknar vi ut din kötid. Du hittar det på Mina sidor hos bostad.stockholm.se.</p>
            )}
            <div className="mt-4">
              <QueueDateForm value={user.queueRegisteredAt ? user.queueRegisteredAt.toISOString().slice(0, 10) : ""} />
            </div>
            <p className="mt-3 text-xs text-muted">
              Bostadsförmedlingen erbjuder tyvärr ingen inloggning via OAuth, så kötiden kan inte hämtas automatiskt. Datumet sparas bara här.
            </p>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.05} className="card p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><ShieldCheck className="size-5" /></span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Notiser på datorn</h2>
            <p className="mt-1 text-sm text-muted">
              Push-notiser skickas till varje enhet där du aktiverat dem. {pushCount > 0 ? `Aktiverat på ${pushCount} ${pushCount === 1 ? "enhet" : "enheter"}.` : "Inte aktiverat på någon enhet än."}
            </p>
            <div className="mt-4"><PushToggle /></div>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.1} className="card p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Mail className="size-5" /></span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Profil</h2>
            <div className="mt-4"><NameForm value={user.name} /></div>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.15} className="card overflow-hidden">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-lg font-semibold">Skickade notiser</h2>
          <p className="text-sm text-muted">De senaste annonserna vi hört av oss om.</p>
        </div>
        {notifications.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted">Inga notiser skickade än.</p>
        ) : (
          <ul className="divide-y divide-line">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-4 px-6 py-3 text-sm">
                <div className="min-w-0">
                  <a href={n.listing.url} target="_blank" rel="noreferrer" className="truncate font-medium text-brand-700 hover:underline">
                    {n.listing.gatuadress}, {n.listing.stadsdel}
                  </a>
                  <p className="text-xs text-muted">{n.watch.name} · {formatDateTime(n.createdAt)}</p>
                </div>
                <div className="flex shrink-0 gap-1.5 text-xs text-muted">
                  {n.emailSent && <span className="chip">Mail</span>}
                  {n.pushSent && <span className="chip">Push</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </FadeIn>
    </div>
  );
}

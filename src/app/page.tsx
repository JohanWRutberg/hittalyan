import Link from "next/link";
import { Bell, Filter, Mail, Clock3, ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { FadeIn } from "@/components/motion";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function LandingPage() {
  const [session, activeCount, lastRun] = await Promise.all([
    getSession(),
    prisma.listing.count({ where: { active: true } }),
    prisma.pollRun.findFirst({ where: { ok: true }, orderBy: { startedAt: "desc" } }),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          {session ? (
            <Link href="/app" className="btn-primary">
              Till appen <ArrowRight className="size-4" />
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                Logga in
              </Link>
              <Link href="/register" className="btn-primary">
                Skapa konto
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
              <span className="size-1.5 rounded-full bg-brand-500" /> Bevakar Bostadsförmedlingen varje timme
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-ink sm:text-6xl">
              Missa aldrig en ny hyresrätt i Stockholm igen.
            </h1>
            <p className="mt-5 text-lg text-muted">
              Hitta Lyan håller koll på Bostadsförmedlingens nya annonser och skickar mail och notis direkt när något dyker upp
              som matchar ditt område, dina rum, din hyra – eller ett specifikt hus du drömmer om.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={session ? "/app" : "/register"} className="btn-primary px-6 py-3 text-base">
                Kom igång gratis <ArrowRight className="size-4" />
              </Link>
              <Link href="/app" className="btn-secondary px-6 py-3 text-base">
                Visa lägenheter
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted">
              Just nu <strong className="text-ink">{activeCount}</strong> aktiva annonser
              {lastRun?.finishedAt && (
                <>
                  {" "}
                  · senast uppdaterat{" "}
                  {new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short" }).format(lastRun.finishedAt)}
                </>
              )}
            </p>
          </FadeIn>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Filter, title: "Filtrera exakt", text: "Kommun, stadsdel, adress, rum, kvm, hyra, våning, balkong och hiss." },
            { icon: Bell, title: "Notis på datorn", text: "Push-notis i webbläsaren så fort en matchande annons publiceras." },
            { icon: Mail, title: "Mail direkt", text: "Ett snyggt mail med länk rakt in till annonsen så du kan anmäla intresse." },
            { icon: Clock3, title: "Din kötid", text: "Se hur många år och dagar du stått i bostadskön, alltid uppdaterat." },
          ].map((f, i) => (
            <FadeIn key={f.title} delay={0.1 + i * 0.06} className="card p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </FadeIn>
          ))}
        </section>
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        Hitta Lyan är en fristående tjänst och har ingen koppling till Bostadsförmedlingen i Stockholm AB.
      </footer>
    </div>
  );
}

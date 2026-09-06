"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { signUp } from "@/lib/auth-client";
import { FadeIn } from "@/components/motion";
import { MarketPicker } from "@/components/market-picker";
import type { Market } from "@/lib/markets";

export function RegisterForm({ initialMarket }: { initialMarket: Market }) {
  const t = useTranslations("auth");
  const tm = useTranslations("markets");
  const locale = useLocale();
  const router = useRouter();
  const [market, setMarket] = useState<Market>(initialMarket);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password.length < 8) {
      setError(t("register.passwordShort"));
      return;
    }
    setLoading(true);
    const { error } = await signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password,
      // Nya konton får språket de registrerade sig på, används i mail och push
      locale,
      // Kön kontot tillhör. Går att byta under Konto.
      market,
    } as Parameters<typeof signUp.email>[0]);
    setLoading(false);
    if (error) {
      setError(error.code === "USER_ALREADY_EXISTS" ? t("register.errorExists") : (error.message ?? t("register.errorGeneric")));
      return;
    }
    router.push("/konto?ny=1");
    router.refresh();
  }

  return (
    <FadeIn>
      <h1 className="text-2xl font-bold tracking-tight">{t("register.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("register.lead")}</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="name">{t("fields.name")}</label>
          <input id="name" name="name" autoComplete="name" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">{t("fields.email")}</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">{t("fields.passwordMin")}</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
        </div>
        <div>
          <span className="label">{tm("chooseLabel")}</span>
          <p className="-mt-1 mb-2 text-xs text-muted">{tm("chooseHelp")}</p>
          <MarketPicker value={market} onSelect={setMarket} disabled={loading} />
        </div>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? t("register.submitting") : t("register.submit")}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {t("register.hasAccount")}{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          {t("register.loginLink")}
        </Link>
      </p>
    </FadeIn>
  );
}

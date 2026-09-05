"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "@/lib/auth-client";
import { FadeIn } from "@/components/motion";

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const { error } = await signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setLoading(false);
    if (error) {
      setError(error.status === 403 && error.code === "BANNED_USER" ? t("login.errorBanned") : t("login.errorInvalid"));
      return;
    }
    router.push("/lagenheter");
    router.refresh();
  }

  return (
    <FadeIn>
      <h1 className="text-2xl font-bold tracking-tight">{t("login.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("login.lead")}</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">{t("fields.email")}</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label className="label" htmlFor="password">{t("fields.password")}</label>
            <Link href="/glomt-losenord" className="mb-1.5 text-xs font-medium text-brand-700 hover:underline">
              {t("forgot.link")}
            </Link>
          </div>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
        </div>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? t("login.submitting") : t("login.submit")}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {t("login.noAccount")}{" "}
        <Link href="/register" className="font-semibold text-brand-700 hover:underline">
          {t("login.createHere")}
        </Link>
      </p>
    </FadeIn>
  );
}

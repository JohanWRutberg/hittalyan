"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { FadeIn } from "@/components/motion";
import { OtpInput } from "@/components/otp-input";

type Step = "email" | "code" | "done";

/** Glömt lösenord: e-post → sexsiffrig kod → nytt lösenord. */
export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot");
  const ta = useTranslations("auth");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await authClient.forgetPassword.emailOtp({ email });
    setBusy(false);
    // Svaret avslöjar inte om adressen finns, så vi går alltid vidare till kodsteget.
    if (error && error.status !== 200) {
      setError(t("errorSend"));
      return;
    }
    setOtp("");
    setStep("code");
  }

  async function submitNewPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const password = String(new FormData(e.currentTarget).get("password"));
    if (password.length < 8) {
      setError(ta("register.passwordShort"));
      return;
    }
    setBusy(true);
    const { error } = await authClient.emailOtp.resetPassword({ email, otp, password });
    setBusy(false);
    if (error) {
      setError(t("errorCode"));
      return;
    }
    setStep("done");
  }

  if (step === "done") {
    return (
      <FadeIn className="text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <CheckCircle2 className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("done")}</p>
        <Link href="/login" className="btn-primary mt-6 w-full">
          {t("toLogin")}
        </Link>
      </FadeIn>
    );
  }

  return (
    <FadeIn>
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted">{step === "email" ? t("step1Lead") : t("step2Lead", { email })}</p>

      {step === "email" ? (
        <form onSubmit={sendCode} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">{ta("fields.email")}</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? t("sending") : t("send")}
          </button>
        </form>
      ) : (
        <form onSubmit={submitNewPassword} className="mt-6 space-y-4">
          <div>
            <span className="label">{t("code")}</span>
            <OtpInput value={otp} onChange={setOtp} />
          </div>
          <div>
            <label className="label" htmlFor="password">{t("newPassword")}</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
          </div>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={busy || otp.length < 6} className="btn-primary w-full">
            {busy ? t("submitting") : t("submit")}
          </button>
          <div className="flex justify-between text-sm">
            <button type="button" className="text-muted hover:text-ink hover:underline" onClick={() => setStep("email")}>
              {t("back")}
            </button>
            <button type="button" disabled={busy} className="font-medium text-brand-700 hover:underline" onClick={() => sendCode()}>
              {t("resend")}
            </button>
          </div>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          {t("toLogin")}
        </Link>
      </p>
    </FadeIn>
  );
}

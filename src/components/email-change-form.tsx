"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Mail } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { OtpInput } from "@/components/otp-input";

type Step = "idle" | "code" | "done";

/**
 * Byte av e-postadress. Koden skickas till den NYA adressen, så den måste
 * bevisas ägd innan bytet genomförs.
 */
export function EmailChangeForm({ current }: { current: string }) {
  const t = useTranslations("account.email");
  const tc = useTranslations("common");
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await authClient.emailOtp.requestEmailChange({ newEmail });
    setBusy(false);
    if (error) {
      setError(t("errorSend"));
      return;
    }
    setOtp("");
    setStep("code");
  }

  async function confirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await authClient.emailOtp.changeEmail({ newEmail, otp });
    setBusy(false);
    if (error) {
      setError(t("errorCode"));
      return;
    }
    setStep("done");
    router.refresh();
  }

  if (step === "done") {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-sm text-brand-900">
        <CheckCircle2 className="size-4 shrink-0" /> {t("changed")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {t("current")}: <span className="font-medium text-ink">{current}</span>
      </p>

      {step === "idle" ? (
        <form onSubmit={sendCode} className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <label className="label" htmlFor="newEmail">{t("newLabel")}</label>
            <input
              id="newEmail"
              type="email"
              autoComplete="email"
              required
              className="input"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <button type="submit" disabled={busy} className="btn-secondary">
            <Mail className="size-4" /> {busy ? t("sending") : t("send")}
          </button>
        </form>
      ) : (
        <form onSubmit={confirm} className="space-y-3">
          <p className="text-sm text-muted">{t("codeLead", { email: newEmail })}</p>
          <div className="max-w-56">
            <label className="label" htmlFor="emailOtp">{t("code")}</label>
            <OtpInput id="emailOtp" value={otp} onChange={setOtp} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || otp.length < 6} className="btn-primary">
              {busy ? t("confirming") : t("confirm")}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setStep("idle")}>
              {tc("cancel")}
            </button>
          </div>
        </form>
      )}

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="text-xs text-muted">{t("note")}</p>
    </div>
  );
}

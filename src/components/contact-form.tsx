"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Send, CheckCircle2 } from "lucide-react";
import { sendContact } from "@/app/(app)/kontakt/actions";
import { CONTACT_SUBJECTS, MESSAGE_MAX } from "@/lib/contact";
import { FadeIn } from "@/components/motion";

/**
 * Namn och e-post kommer från kontot och går inte att ändra – de visas låsta så
 * att man ser vad vi svarar till. Servern läser dem ändå från kontot, inte
 * härifrån.
 */
export function ContactForm({ name, email }: { name: string; email: string }) {
  const t = useTranslations("contact");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(sendContact, undefined);
  const [length, setLength] = useState(0);

  if (state?.ok) {
    return (
      <FadeIn className="card flex flex-col items-center gap-3 p-10 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <CheckCircle2 className="size-6" />
        </span>
        <p className="text-lg font-semibold">{t("sent.title")}</p>
        <p className="text-sm text-muted">{t("sent.lead", { email })}</p>
      </FadeIn>
    );
  }

  return (
    <FadeIn>
      <form action={action} className="card space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="contact-name">{t("name")}</label>
            <input id="contact-name" value={name} readOnly disabled className="input bg-canvas text-muted" />
          </div>
          <div>
            <label className="label" htmlFor="contact-email">{t("email")}</label>
            <input id="contact-email" value={email} readOnly disabled className="input bg-canvas text-muted" />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted">{t("fromAccount")}</p>

        <div>
          <label className="label" htmlFor="subject">{t("subject")}</label>
          <select id="subject" name="subject" required defaultValue="" className="input">
            <option value="" disabled>
              {t("subjectPlaceholder")}
            </option>
            {CONTACT_SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {t(`subjects.${s}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="message">{t("message")}</label>
          <textarea
            id="message"
            name="message"
            required
            rows={8}
            maxLength={MESSAGE_MAX}
            placeholder={t("messagePlaceholder")}
            onChange={(e) => setLength(e.currentTarget.value.length)}
            className="input resize-y"
          />
          <p className="mt-1 text-right text-xs text-muted">
            {length}/{MESSAGE_MAX}
          </p>
        </div>

        {state?.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

        <div className="flex justify-end">
          <button type="submit" disabled={pending} className="btn-primary">
            <Send className="size-4" /> {pending ? t("sending") : tc("send")}
          </button>
        </div>
      </form>
    </FadeIn>
  );
}

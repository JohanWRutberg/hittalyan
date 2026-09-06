"use server";

import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { sendContactEmail } from "@/lib/notify";
import { MESSAGE_MAX, SUBJECT_LABEL_SV, isContactSubject } from "@/lib/contact";
import { marketInfo, marketOf } from "@/lib/markets";
import { planState } from "@/lib/plan";

export type ContactState = { error?: string; ok?: boolean } | undefined;

/**
 * Skickar ett meddelande från en inloggad användare. Namn och adress tas från
 * kontot och inte från formuläret: fälten är låsta i gränssnittet, och skulle
 * ändå gå att ändra i en webbläsare.
 */
export async function sendContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const session = await requireSession();
  const t = await getTranslations("contact.errors");

  const subject = String(formData.get("subject") ?? "");
  if (!isContactSubject(subject)) return { error: t("subject") };

  const message = String(formData.get("message") ?? "").trim();
  if (message.length < 10) return { error: t("tooShort") };
  if (message.length > MESSAGE_MAX) return { error: t("tooLong", { max: MESSAGE_MAX }) };

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const sent = await sendContactEmail({
    name: user.name,
    email: user.email,
    subjectLabel: SUBJECT_LABEL_SV[subject],
    message,
    market: marketInfo(marketOf(user.market)).name,
    plan: planState(user).labelKey,
  });

  return sent ? { ok: true } : { error: t("send") };
}

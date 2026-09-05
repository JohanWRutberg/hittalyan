"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";

/** Byter språk: cookie för gränssnittet, och sparas på användaren för mail och push. */
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const session = await getSession();
  if (session) await prisma.user.update({ where: { id: session.user.id }, data: { locale } }).catch(() => undefined);
}

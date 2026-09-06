"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { MARKET_COOKIE, isMarket } from "@/lib/markets";

/**
 * Byter bostadsförmedling. För inloggade sparas valet på kontot, som är det som
 * gäller. Cookien sätts ändå, så att samma stad visas om man loggar ut.
 */
export async function setMarket(market: string) {
  if (!isMarket(market)) return;
  (await cookies()).set(MARKET_COOKIE, market, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const session = await getSession();
  if (session) {
    await prisma.user.update({ where: { id: session.user.id }, data: { market } }).catch(() => undefined);
  }
  revalidatePath("/lagenheter", "layout");
  revalidatePath("/konto");
  revalidatePath("/bevakningar");
}

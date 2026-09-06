import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { MARKET_COOKIE, marketOf, type Market } from "@/lib/markets";

/**
 * Vilken bostadsförmedling som visas just nu. Inloggade ser sin egen kö, som de
 * väljer vid registrering och byter under Konto. Utloggade besökare styr valet
 * med en cookie, och får Stockholm om de inte valt något.
 *
 * Valet läses ur databasen och inte ur sessionen, eftersom Better Auth cachar
 * sessionen i fem minuter och ett kösbyte ska slå igenom direkt.
 */
export const getCurrentMarket = cache(async (): Promise<Market> => {
  const session = await getSession();
  if (session) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { market: true } });
    return marketOf(user?.market);
  }
  return marketOf((await cookies()).get(MARKET_COOKIE)?.value);
});

/** Användarens registreringsdatum i en viss kö, eller null om det inte angetts. */
export async function getQueueDate(userId: string, market: Market): Promise<Date | null> {
  const row = await prisma.userQueue.findUnique({
    where: { userId_market: { userId, market } },
    select: { registeredAt: true },
  });
  return row?.registeredAt ?? null;
}

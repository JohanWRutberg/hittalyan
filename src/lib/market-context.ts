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
  const user = await getCurrentUser();
  if (user) return marketOf(user.market);
  return marketOf((await cookies()).get(MARKET_COOKIE)?.value);
});

/**
 * Den inloggade användarens rad, hämtad **en gång per anrop**.
 *
 * Sidorna behöver nästan alltid både vald kö och planen, och hämtade tidigare
 * raden en gång var: en fråga för kön här och en till i sidan. `cache()` gör
 * dem till samma fråga. Ur databasen och inte ur sessionen, av samma skäl som
 * ovan – Better Auth cachar sessionen i fem minuter.
 */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
});

/** Användarens registreringsdatum i en viss kö, eller null om det inte angetts. */
export async function getQueueDate(userId: string, market: Market): Promise<Date | null> {
  const row = await prisma.userQueue.findUnique({
    where: { userId_market: { userId, market } },
    select: { registeredAt: true },
  });
  return row?.registeredAt ?? null;
}

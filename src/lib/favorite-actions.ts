"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { hasPro } from "@/lib/plan";

export type FavoriteResult = { ok: boolean; favorited: boolean; needsPro?: boolean };

/**
 * Sparar eller tar bort en favorit. Favoriter är en Pro-funktion, så kontrollen
 * görs här och inte bara i gränssnittet.
 */
export async function toggleFavorite(listingId: string): Promise<FavoriteResult> {
  const session = await getSession();
  if (!session) return { ok: false, favorited: false };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, planExpiresAt: true, planSource: true, role: true, stripeSubscriptionStatus: true },
  });
  if (!user || !hasPro(user)) return { ok: false, favorited: false, needsPro: true };

  const existing = await prisma.favorite.findUnique({
    where: { userId_listingId: { userId: session.user.id, listingId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
  } else {
    // Annonsen kan ha städats bort mellan sidladdning och klick.
    const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: { id: true } });
    if (!listing) return { ok: false, favorited: false };
    await prisma.favorite.create({ data: { userId: session.user.id, listingId } });
  }

  revalidatePath("/bevakningar");
  return { ok: true, favorited: !existing };
}

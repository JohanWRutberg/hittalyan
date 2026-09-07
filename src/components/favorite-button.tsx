"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { toggleFavorite } from "@/lib/favorite-actions";
import { useHoveredListing } from "@/components/hovered-listing";

/**
 * Hjärtat på annonskortet. Ligger utanför kortets <a>, eftersom en knapp inte
 * får ligga i en länk. Uppdaterar sig direkt och backar om servern säger nej.
 */
export function FavoriteButton({ listingId }: { listingId: string }) {
  const t = useTranslations("favorites");
  const router = useRouter();
  // Delat med kartan, så att markörens hjärta ändras i samma ögonblick.
  const { favorites, setFavorite } = useHoveredListing();
  const on = favorites.has(listingId);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={on}
      title={on ? t("remove") : t("add")}
      aria-label={on ? t("remove") : t("add")}
      onClick={() => {
        const next = !on;
        setFavorite(listingId, next);
        start(async () => {
          const res = await toggleFavorite(listingId);
          if (!res.ok) {
            setFavorite(listingId, !next); // servern sa nej: backa
            if (res.needsPro) router.push("/pro?status=required");
            return;
          }
          setFavorite(listingId, res.favorited);
        });
      }}
      // Samma platta som bildräknaren i motsatt hörn: fast svart, oberoende av
      // tema. Hover och tryckyta ligger i globals.css, eftersom Tailwinds
      // hover-variant även gäller pekskärm där tillståndet blir kvar efter tryck.
      className={`favorite-button grid size-7 place-items-center rounded-full bg-black/55 shadow-soft transition disabled:opacity-60 ${
        on ? "text-red-400" : "text-white/80"
      }`}
    >
      <Heart className={`size-4 ${on ? "fill-current" : ""}`} />
    </button>
  );
}

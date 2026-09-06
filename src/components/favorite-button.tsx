"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { toggleFavorite } from "@/lib/favorite-actions";

/**
 * Hjärtat på annonskortet. Ligger utanför kortets <a>, eftersom en knapp inte
 * får ligga i en länk. Uppdaterar sig direkt och backar om servern säger nej.
 */
export function FavoriteButton({ listingId, initial }: { listingId: string; initial: boolean }) {
  const t = useTranslations("favorites");
  const router = useRouter();
  const [on, setOn] = useState(initial);
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
        setOn(next);
        start(async () => {
          const res = await toggleFavorite(listingId);
          if (!res.ok) {
            setOn(!next);
            if (res.needsPro) router.push("/pro?status=required");
            return;
          }
          setOn(res.favorited);
        });
      }}
      className={`grid size-9 place-items-center rounded-full bg-white/90 shadow-soft transition hover:bg-white disabled:opacity-60 ${
        on ? "text-red-500" : "text-slate-400 hover:text-red-500"
      }`}
    >
      <Heart className={`size-4.5 ${on ? "fill-current" : ""}`} />
    </button>
  );
}

"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * Delat tillstånd mellan listan och kartan.
 *
 * hovered: vilken annons som hovras, så att kartans markör kan markeras
 * samtidigt som man hovrar över kortet i listan.
 *
 * armedId: på pekskärm har ett kort tryckts en gång (visas på kartan);
 * nästa tryck på samma kort öppnar annonsen. Ligger här, inte per kort,
 * så att ett tryck på ett annat kort alltid räknas som ett första tryck.
 *
 * favorites: vilka annonser som är favoritmarkerade. Ligger här så att hjärtat
 * på kortet och hjärtat på kartans markör ändras i samma ögonblick, utan att
 * sidan behöver renderas om.
 */
const HoveredListingContext = createContext<{
  hovered: string | null;
  setHovered: (id: string | null) => void;
  armedId: string | null;
  setArmedId: (id: string | null) => void;
  favorites: ReadonlySet<string>;
  setFavorite: (id: string, on: boolean) => void;
}>({
  hovered: null,
  setHovered: () => {},
  armedId: null,
  setArmedId: () => {},
  favorites: new Set(),
  setFavorite: () => {},
});

export function HoveredListingProvider({
  children,
  initialFavorites = [],
}: {
  children: React.ReactNode;
  /** Favoriter från servern vid sidladdning */
  initialFavorites?: string[];
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(() => new Set(initialFavorites));

  const setFavorite = useCallback((id: string, on: boolean) => {
    setFavorites((prev) => {
      if (prev.has(id) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ hovered, setHovered, armedId, setArmedId, favorites, setFavorite }),
    [hovered, armedId, favorites, setFavorite],
  );
  return <HoveredListingContext value={value}>{children}</HoveredListingContext>;
}

export const useHoveredListing = () => useContext(HoveredListingContext);

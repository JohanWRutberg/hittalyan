"use client";

import { createContext, useContext, useMemo, useState } from "react";

/**
 * Delar vilken annons som hovras, så att kartans markör kan markeras
 * samtidigt som man hovrar över kortet i listan.
 *
 * armedId: på pekskärm har ett kort tryckts en gång (visas på kartan);
 * nästa tryck på samma kort öppnar annonsen. Ligger här, inte per kort,
 * så att ett tryck på ett annat kort alltid räknas som ett första tryck.
 */
const HoveredListingContext = createContext<{
  hovered: number | null;
  setHovered: (id: number | null) => void;
  armedId: number | null;
  setArmedId: (id: number | null) => void;
}>({ hovered: null, setHovered: () => {}, armedId: null, setArmedId: () => {} });

export function HoveredListingProvider({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [armedId, setArmedId] = useState<number | null>(null);
  const value = useMemo(() => ({ hovered, setHovered, armedId, setArmedId }), [hovered, armedId]);
  return <HoveredListingContext value={value}>{children}</HoveredListingContext>;
}

export const useHoveredListing = () => useContext(HoveredListingContext);

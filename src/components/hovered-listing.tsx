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
  hovered: string | null;
  setHovered: (id: string | null) => void;
  armedId: string | null;
  setArmedId: (id: string | null) => void;
}>({ hovered: null, setHovered: () => {}, armedId: null, setArmedId: () => {} });

export function HoveredListingProvider({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const value = useMemo(() => ({ hovered, setHovered, armedId, setArmedId }), [hovered, armedId]);
  return <HoveredListingContext value={value}>{children}</HoveredListingContext>;
}

export const useHoveredListing = () => useContext(HoveredListingContext);

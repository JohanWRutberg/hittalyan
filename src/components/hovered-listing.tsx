"use client";

import { createContext, useContext, useMemo, useState } from "react";

/**
 * Delar vilken annons som hovras, så att kartans markör kan markeras
 * samtidigt som man hovrar över kortet i listan.
 */
const HoveredListingContext = createContext<{
  hovered: number | null;
  setHovered: (id: number | null) => void;
}>({ hovered: null, setHovered: () => {} });

export function HoveredListingProvider({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const value = useMemo(() => ({ hovered, setHovered }), [hovered]);
  return <HoveredListingContext value={value}>{children}</HoveredListingContext>;
}

export const useHoveredListing = () => useContext(HoveredListingContext);

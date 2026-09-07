"use client";

import { createContext, useContext } from "react";

/**
 * Om den fastnaglade panelen (filter + karta + sortering) ligger uppe i toppen.
 *
 * Delarna renderas av olika komponenter men ska se ut som ett fält: raka hörn där
 * de möter varandra, och kompaktare höjd. Kartan äger tillståndet och delar det
 * här, i stället för att varje del mäter scrollen för sig.
 */
const StickyPanelContext = createContext(false);

export const StickyPanelProvider = StickyPanelContext.Provider;
export const useStickyPanel = () => useContext(StickyPanelContext);

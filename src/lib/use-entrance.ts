"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Ska en intoning köras? Bara för det som monteras **efter** att sidan kommit på
 * plats – en ny sida i listan, en ny sortering – aldrig för det servern redan ritat.
 *
 * Intoningarna startade förut från `opacity: 0`, och Framer Motion skriver det
 * startvärdet i serverns HTML. Allt innehåll med intoning var alltså osynligt tills
 * JavaScript hade laddat och hydrerat sidan: Lighthouse räknade 60 osynliga element
 * på /lagenheter, och Speed Index landade på nästan åtta sekunder i produktion.
 *
 * `useSyncExternalStore` ger `false` på servern och under hydreringen – även för
 * delar som strömmas in senare – och `true` för det som monteras därefter. Det är
 * samma skiljelinje som React själv drar, så serverns HTML och webbläsarens första
 * rendering blir alltid lika. Ett eget "har sidan hydrerats"-värde hade inte klarat
 * strömmade delar: de hydreras efter att flaggan redan slagit om.
 */
export function useAnimateEntrance(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

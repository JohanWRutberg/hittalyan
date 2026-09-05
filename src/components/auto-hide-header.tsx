"use client";

import { useEffect, useRef, useState } from "react";

/** Hur långt ner på sidan menyn alltid visas. */
const TOP_ZONE = 140;
/** Hur mycket man måste scrolla nedåt innan menyn glider undan. */
const HIDE_AFTER = 90;
/** Hur mycket man måste scrolla uppåt innan den kommer tillbaka. */
const SHOW_AFTER = 50;

/**
 * Menyn glider undan en stund efter att man börjat scrolla nedåt och kommer
 * tillbaka när man scrollar uppåt. Höjden publiceras som --nav-h så att den
 * sticky kartan kan lägga sig precis under menyn, eller högst upp när den är dold.
 */
export function AutoHideHeader({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let down = 0;
    let up = 0;

    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;

      if (y < TOP_ZONE) {
        down = 0;
        up = 0;
        setHidden(false);
        return;
      }
      if (dy > 0) {
        down += dy;
        up = 0;
        if (down > HIDE_AFTER) setHidden(true);
      } else if (dy < 0) {
        up -= dy;
        down = 0;
        if (up > SHOW_AFTER) setHidden(false);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Publicera menyns höjd (0 när den är dold) för den sticky kartan
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publish = () => {
      document.documentElement.style.setProperty("--nav-h", hidden ? "0px" : `${el.offsetHeight}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hidden]);

  return (
    <header
      ref={ref}
      data-hidden={hidden || undefined}
      className="sticky top-0 z-30 border-b border-line bg-white/80 backdrop-blur transition-transform duration-300 ease-out data-hidden:-translate-y-full motion-reduce:transition-none"
    >
      {children}
    </header>
  );
}

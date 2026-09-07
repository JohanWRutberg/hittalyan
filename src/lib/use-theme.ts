"use client";

import { useEffect, useState } from "react";

/**
 * Vilket läge som faktiskt gäller just nu, ljust eller mörkt.
 *
 * Läses av `data-theme` på <html>, som både skriptet i <head> och växlaren
 * skriver till. Vi bevakar attributet i stället för att prenumerera på
 * växlaren, så att systemets egna byten också fångas.
 */
export function useResolvedTheme(): "light" | "dark" {
  // Servern kan inte veta läget, så vi börjar ljust och rättar efter montering.
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.dataset.theme === "dark" ? "dark" : "light");
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

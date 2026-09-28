"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition } from "react";

/**
 * Navigering inom annonslistan: sortering, filter och "rensa".
 *
 * Sortering och filter ändrar adressen, och servern räknar fram listan på nytt.
 * Det tar en stund, och förut hände ingenting på skärmen under tiden – chippet
 * slog inte om förrän svaret kom, så det kändes som att klicket inte gått fram.
 * Nu går all sådan navigering genom en gemensam transition:
 *
 * - **Det man klickade på pulserar direkt** (`data-pending`), så klicket syns.
 * - **Listan tonas ned** medan den gamla står kvar, i stället för att frysa.
 * - **Sidan står still.** `router.push` scrollar annars till toppen, och sidan
 *   hoppade vid varje sökning från filterpanelen.
 *
 * Transitionen håller den gamla listan på skärmen tills den nya är klar, så inget
 * skelett blinkar förbi mellan två sorteringar.
 */
export interface ListingsNav {
  /** En navigering pågår. */
  pending: boolean;
  /** Adressen som håller på att laddas, för att markera just det man klickade på. */
  pendingHref: string | null;
  navigate: (href: string) => void;
}

const ListingsNavContext = createContext<ListingsNav | null>(null);

export const ListingsNavProvider = ListingsNavContext.Provider;

/** Tillståndet ägs av listan, som ger det vidare till sorteringen och filtret. */
export function useListingsNavState(): ListingsNav {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  return {
    pending,
    pendingHref: pending ? pendingHref : null,
    navigate: (href) => {
      setPendingHref(href);
      start(() => router.push(href, { scroll: false }));
    },
  };
}

/** Listans navigering, eller en egen om komponenten används utanför listan. */
export function useListingsNav(): ListingsNav {
  const shared = useContext(ListingsNavContext);
  // Anropas alltid, så att hookarnas ordning inte beror på var komponenten står.
  const own = useListingsNavState();
  return shared ?? own;
}

/**
 * En länk inom listan. Vanlig `<Link>` för allt utom ett vanligt vänsterklick: då
 * går den via den gemensamma transitionen. Cmd-klick och mittenklick öppnar
 * fortfarande en ny flik, precis som en länk ska.
 *
 * Klicket stoppas från att bubbla vidare: länkarna sitter i rader som själva är
 * klickbara (filterpanelens rubrikrad fäller ihop panelen).
 */
export function ListingsNavLink({
  href,
  className,
  children,
  ...rest
}: Omit<React.ComponentProps<typeof Link>, "href" | "onClick"> & { href: string }) {
  const { navigate, pendingHref } = useListingsNav();
  const isPending = pendingHref === href;
  return (
    <Link
      {...rest}
      href={href}
      scroll={false}
      data-pending={isPending || undefined}
      aria-busy={isPending || undefined}
      className={`${className ?? ""} data-pending:animate-pulse`}
      onClick={(e) => {
        e.stopPropagation();
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </Link>
  );
}

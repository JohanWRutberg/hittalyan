/**
 * Platshållare medan en sida hämtas.
 *
 * Sidorna renderas på servern och hämtar sitt innehåll ur databasen, så ett
 * sidbyte kostar alltid ett anrop. Utan `loading.tsx` står webbläsaren kvar på
 * den gamla sidan under tiden och det ser ut som att ingenting händer – och
 * Next hoppar dessutom över förhämtningen av dynamiska sidor helt när det inte
 * finns något skelett att hämta. Med skelettet blir bytet omedelbart, och
 * ramen kring innehållet (meny, rubrik, kortrutnät) hinner ritas medan
 * databasen svarar.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-subtle motion-reduce:animate-none ${className}`} />;
}

/** Rubriken högst upp på en sida: titel och underrubrik. */
export function SkeletonHeading() {
  return (
    <div className="space-y-2.5">
      <Skeleton className="h-8 w-56 max-w-full" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

/** Ett kort i skelettform. `lines` styr hur högt det blir. */
export function SkeletonCard({ className = "h-32" }: { className?: string }) {
  return <Skeleton className={`w-full ${className}`} />;
}

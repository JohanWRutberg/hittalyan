import Link from "next/link";
import { Building2 } from "lucide-react";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2 text-ink">
      <span className="grid size-8 place-items-center rounded-xl bg-brand-600 text-white shadow-soft">
        {/* Hyreshus, inte villa. Samma form som platshållaren på annonser utan
            bild, och som favicon och app-ikonerna. */}
        <Building2 className="size-4.5" strokeWidth={2.2} />
      </span>
      <span className="whitespace-nowrap text-base font-bold tracking-tight max-[379px]:hidden sm:text-lg">Hitta Lyan</span>
    </Link>
  );
}

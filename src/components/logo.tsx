import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-ink">
      <span className="grid size-8 place-items-center rounded-xl bg-brand-600 text-white shadow-soft">
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5 10v10h14V10" />
          <path d="M10 20v-6h4v6" />
        </svg>
      </span>
      <span className="text-lg font-bold tracking-tight">Hitta Lyan</span>
    </Link>
  );
}

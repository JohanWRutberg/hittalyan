import Link from "next/link";
import { Crown, Lock } from "lucide-react";
import type { PlanInfo } from "@/lib/plan";

/** Kort som visas när en Pro-funktion är låst. */
export function ProGate({ info, what }: { info: PlanInfo; what: string }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <Lock className="size-5" />
      </span>
      <h2 className="text-lg font-semibold">{what} kräver Pro</h2>
      <p className="max-w-md text-sm text-muted">{info.detail} Med Pro får du obegränsat med bevakningar och notiser via mail och push, från 49 kr per månad.</p>
      <Link href="/app/pro" className="btn-primary mt-2">
        <Crown className="size-4" /> Se Pro
      </Link>
    </div>
  );
}

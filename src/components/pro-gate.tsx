import Link from "next/link";
import { Crown, Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { PlanInfo } from "@/lib/plan";

/** Kort som visas när en Pro-funktion är låst. */
export async function ProGate({ info, what }: { info: PlanInfo; what: string }) {
  const t = await getTranslations("pro.gate");
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <Lock className="size-5" />
      </span>
      <h2 className="text-lg font-semibold">{t("title", { what })}</h2>
      <p className="max-w-md text-sm text-muted">{info.detail} {t("text")}</p>
      <Link href="/app/pro" className="btn-primary mt-2">
        <Crown className="size-4" /> {t("cta")}
      </Link>
    </div>
  );
}

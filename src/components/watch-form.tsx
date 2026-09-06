"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Bell, Mail, Save } from "lucide-react";
import type { Watch } from "@/generated/prisma/client";
import type { AreaMap, Filters } from "@/lib/filters";
import { marketInfo, type Market } from "@/lib/markets";
import type { AreaCounts } from "@/lib/areas";
import { FilterFields, Check } from "@/components/filter-fields";
import { saveWatch } from "@/app/(app)/actions";
import { FadeIn } from "@/components/motion";

export function WatchForm({
  areas,
  watch,
  initialFilters,
  pushReady,
  counts,
  market,
}: {
  areas: AreaMap;
  watch?: Watch | null;
  initialFilters: Partial<Filters>;
  pushReady: boolean;
  counts?: AreaCounts;
  /** Förmedlingen bevakningen gäller */
  market: Market;
}) {
  const t = useTranslations("watches.form");
  const info = marketInfo(market);
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(saveWatch, undefined);

  return (
    <FadeIn>
      <form action={action} className="card space-y-6 p-6">
        {watch && <input type="hidden" name="id" value={watch.id} />}
        <p className="text-sm text-muted">{t("marketNote", { source: info.name })}</p>
        <div>
          <label className="label" htmlFor="name">{t("name")}</label>
          <input id="name" name="name" defaultValue={watch?.name ?? ""} required placeholder={t("namePlaceholder")} className="input" />
        </div>

        <FilterFields areas={areas} initial={initialFilters} compact counts={counts} market={market} />

        <div>
          <span className="label">{t("notifications")}</span>
          <div className="grid gap-2 sm:grid-cols-2">
            <Check name="notifyEmail" label={t("email")} checked={watch?.notifyEmail ?? true} description={t("emailDesc")} />
            <Check
              name="notifyPush"
              label={t("push")}
              checked={watch?.notifyPush ?? true}
              description={pushReady ? t("pushReady") : t("pushNotReady")}
            />
          </div>
        </div>

        {state?.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

        <div className="flex items-center justify-end gap-2">
          <Link href="/bevakningar" className="btn-ghost">
            {tc("cancel")}
          </Link>
          <button type="submit" disabled={pending} className="btn-primary">
            <Save className="size-4" /> {pending ? tc("saving") : watch ? t("saveChanges") : t("create")}
          </button>
        </div>
        <p className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1"><Mail className="size-3.5" /> Mail</span>
          <span className="inline-flex items-center gap-1"><Bell className="size-3.5" /> Push</span>
          {t("pollNote", { source: info.name })}
        </p>
      </form>
    </FadeIn>
  );
}

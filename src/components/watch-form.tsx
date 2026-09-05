"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Bell, Mail, Save } from "lucide-react";
import type { Watch } from "@/generated/prisma/client";
import type { AreaMap, Filters } from "@/lib/filters";
import { FilterFields, Check } from "@/components/filter-fields";
import { saveWatch } from "@/app/app/actions";
import { FadeIn } from "@/components/motion";

export function WatchForm({
  areas,
  watch,
  initialFilters,
  pushReady,
}: {
  areas: AreaMap;
  watch?: Watch | null;
  initialFilters: Partial<Filters>;
  pushReady: boolean;
}) {
  const [state, action, pending] = useActionState(saveWatch, undefined);

  return (
    <FadeIn>
      <form action={action} className="card space-y-6 p-6">
        {watch && <input type="hidden" name="id" value={watch.id} />}
        <div>
          <label className="label" htmlFor="name">Namn på bevakningen</label>
          <input id="name" name="name" defaultValue={watch?.name ?? ""} required placeholder="t.ex. Nacka Grace, 3 rok" className="input" />
        </div>

        <FilterFields areas={areas} initial={initialFilters} compact />

        <div>
          <span className="label">Notiser</span>
          <div className="grid gap-2 sm:grid-cols-2">
            <Check name="notifyEmail" label="Skicka mail" checked={watch?.notifyEmail ?? true} description="Till din kontoadress" />
            <Check
              name="notifyPush"
              label="Skicka notis i webbläsaren"
              checked={watch?.notifyPush ?? true}
              description={pushReady ? "Aktiverad på minst en enhet" : "Aktivera under Konto för att få notiser"}
            />
          </div>
        </div>

        {state?.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

        <div className="flex items-center justify-end gap-2">
          <Link href="/app/bevakningar" className="btn-ghost">
            Avbryt
          </Link>
          <button type="submit" disabled={pending} className="btn-primary">
            <Save className="size-4" /> {pending ? "Sparar…" : watch ? "Spara ändringar" : "Skapa bevakning"}
          </button>
        </div>
        <p className="flex items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1"><Mail className="size-3.5" /> Mail</span>
          <span className="inline-flex items-center gap-1"><Bell className="size-3.5" /> Push</span>
          Vi kollar Bostadsförmedlingen varje timme och hör av oss så fort en ny annons matchar.
        </p>
      </form>
    </FadeIn>
  );
}

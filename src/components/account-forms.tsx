"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateName, updateQueueDate } from "@/app/app/actions";

export function QueueDateForm({ value }: { value: string }) {
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(updateQueueDate, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label" htmlFor="queueRegisteredAt">{t("queue.label")}</label>
        <input id="queueRegisteredAt" name="queueRegisteredAt" type="date" defaultValue={value} max={new Date().toISOString().slice(0, 10)} className="input" />
      </div>
      <button type="submit" disabled={pending} className="btn-primary">{pending ? tc("saving") : tc("save")}</button>
      {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
      {state?.ok && <span className="text-sm text-brand-700">{tc("saved")}</span>}
    </form>
  );
}

export function NameForm({ value }: { value: string }) {
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(updateName, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label" htmlFor="name">{t("profile.name")}</label>
        <input id="name" name="name" defaultValue={value} required className="input" />
      </div>
      <button type="submit" disabled={pending} className="btn-secondary">{pending ? tc("saving") : t("profile.update")}</button>
      {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
      {state?.ok && <span className="text-sm text-brand-700">{tc("saved")}</span>}
    </form>
  );
}

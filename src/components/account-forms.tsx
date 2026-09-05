"use client";

import { useActionState } from "react";
import { updateName, updateQueueDate } from "@/app/app/actions";

export function QueueDateForm({ value }: { value: string }) {
  const [state, action, pending] = useActionState(updateQueueDate, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label" htmlFor="queueRegisteredAt">Registreringsdatum i bostadskön</label>
        <input id="queueRegisteredAt" name="queueRegisteredAt" type="date" defaultValue={value} max={new Date().toISOString().slice(0, 10)} className="input" />
      </div>
      <button type="submit" disabled={pending} className="btn-primary">{pending ? "Sparar…" : "Spara"}</button>
      {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
      {state?.ok && <span className="text-sm text-brand-700">Sparat!</span>}
    </form>
  );
}

export function NameForm({ value }: { value: string }) {
  const [state, action, pending] = useActionState(updateName, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label" htmlFor="name">Namn</label>
        <input id="name" name="name" defaultValue={value} required className="input" />
      </div>
      <button type="submit" disabled={pending} className="btn-secondary">{pending ? "Sparar…" : "Uppdatera"}</button>
      {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
      {state?.ok && <span className="text-sm text-brand-700">Sparat!</span>}
    </form>
  );
}

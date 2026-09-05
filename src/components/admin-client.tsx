"use client";

import { useActionState, useTransition } from "react";
import { RefreshCw, ShieldOff, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { adminBan, adminDeleteUser, adminRunPoll, adminSetRole, adminUnban } from "@/app/app/actions";

export function RunPollButton() {
  const [state, action, pending] = useActionState(adminRunPoll, undefined);
  return (
    <form action={action} className="flex items-center gap-3">
      <button type="submit" disabled={pending} className="btn-primary">
        <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} /> {pending ? "Hämtar…" : "Hämta annonser nu"}
      </button>
      {state?.summary && <span className="text-sm text-brand-700">{state.summary}</span>}
      {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
    </form>
  );
}

export function UserActions({ user, isSelf }: { user: { id: string; name: string; role: string | null; banned: boolean | null }; isSelf: boolean }) {
  const [pending, start] = useTransition();
  if (isSelf) return <span className="text-xs text-muted">Du</span>;
  const admin = user.role === "admin";
  return (
    <div className={`flex items-center justify-end gap-1 ${pending ? "opacity-50" : ""}`}>
      <button type="button" className="btn-ghost px-2 py-1.5" title={admin ? "Gör till vanlig användare" : "Gör till admin"} onClick={() => start(() => adminSetRole(user.id, admin ? "user" : "admin"))}>
        <UserCog className={`size-4 ${admin ? "text-brand-600" : ""}`} />
      </button>
      {user.banned ? (
        <button type="button" className="btn-ghost px-2 py-1.5" title="Häv avstängning" onClick={() => start(() => adminUnban(user.id))}>
          <ShieldCheck className="size-4 text-brand-600" />
        </button>
      ) : (
        <button
          type="button"
          className="btn-ghost px-2 py-1.5"
          title="Stäng av"
          onClick={() => {
            const reason = prompt(`Stäng av ${user.name}? Ange gärna en anledning:`, "Avstängd av admin");
            if (reason !== null) start(() => adminBan(user.id, reason));
          }}
        >
          <ShieldOff className="size-4" />
        </button>
      )}
      <button
        type="button"
        className="btn-ghost px-2 py-1.5 hover:text-red-600"
        title="Ta bort konto"
        onClick={() => {
          if (confirm(`Ta bort ${user.name} permanent, inklusive bevakningar?`)) start(() => adminDeleteUser(user.id));
        }}
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

"use client";

import { useActionState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, ShieldOff, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { adminBan, adminDeleteUser, adminRunPoll, adminSetPlan, adminSetRole, adminUnban } from "@/app/(app)/actions";
import { Crown } from "lucide-react";

export function RunPollButton() {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState(adminRunPoll, undefined);
  return (
    <form action={action} className="flex items-center gap-3">
      <button type="submit" disabled={pending} className="btn-primary">
        <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} /> {pending ? t("running") : t("runPoll")}
      </button>
      {state?.summary && <span className="text-sm text-brand-700">{state.summary}</span>}
      {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
    </form>
  );
}

export function UserActions({ user, isSelf }: { user: { id: string; name: string; role: string | null; banned: boolean | null; plan: string }; isSelf: boolean }) {
  const t = useTranslations("admin.actions");
  const tu = useTranslations("admin.users");
  const [pending, start] = useTransition();
  if (isSelf) return <span className="text-xs text-muted">{tu("you")}</span>;
  const admin = user.role === "admin";
  return (
    <div className={`flex items-center justify-end gap-1 ${pending ? "opacity-50" : ""}`}>
      <button
        type="button"
        className="btn-ghost px-2 py-1.5"
        title={user.plan === "pro" ? t("removePro") : t("givePro")}
        onClick={() => {
          if (user.plan === "pro") {
            if (confirm(t("confirmRemovePro", { name: user.name }))) start(() => adminSetPlan(user.id, "free", null));
          } else {
            const m = prompt(t("promptMonths", { name: user.name }), "3");
            if (m !== null) start(() => adminSetPlan(user.id, "pro", m.trim() ? Number(m) : null));
          }
        }}
      >
        <Crown className={`size-4 ${user.plan === "pro" ? "text-amber-500" : ""}`} />
      </button>
      <button type="button" className="btn-ghost px-2 py-1.5" title={admin ? t("makeUser") : t("makeAdmin")} onClick={() => start(() => adminSetRole(user.id, admin ? "user" : "admin"))}>
        <UserCog className={`size-4 ${admin ? "text-brand-600" : ""}`} />
      </button>
      {user.banned ? (
        <button type="button" className="btn-ghost px-2 py-1.5" title={t("unban")} onClick={() => start(() => adminUnban(user.id))}>
          <ShieldCheck className="size-4 text-brand-600" />
        </button>
      ) : (
        <button
          type="button"
          className="btn-ghost px-2 py-1.5"
          title={t("ban")}
          onClick={() => {
            const reason = prompt(t("banPrompt", { name: user.name }), t("banDefault"));
            if (reason !== null) start(() => adminBan(user.id, reason));
          }}
        >
          <ShieldOff className="size-4" />
        </button>
      )}
      <button
        type="button"
        className="btn-ghost px-2 py-1.5 hover:text-red-600"
        title={t("delete")}
        onClick={() => {
          if (confirm(t("confirmDelete", { name: user.name }))) start(() => adminDeleteUser(user.id));
        }}
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

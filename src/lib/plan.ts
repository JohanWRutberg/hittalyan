import type { User } from "@/generated/prisma/client";

export type PlanUser = Pick<User, "plan" | "planExpiresAt" | "planSource" | "role" | "stripeSubscriptionStatus">;

export const TRIAL_DAYS = Math.max(0, Number(process.env.TRIAL_DAYS ?? 14) || 0);

/** Har användaren Pro just nu? Admin har alltid Pro. */
export function hasPro(u: PlanUser, now = new Date()): boolean {
  if (u.role === "admin") return true;
  if (u.plan !== "pro") return false;
  return u.planExpiresAt == null || u.planExpiresAt > now;
}

export type PlanLabelKey = "admin" | "free" | "trial" | "pro";
export type PlanDetailKey = "admin" | "lapsed" | "free" | "trial" | "renewing" | "until" | "indefinite";

/** Rå plandata utan text; etiketterna översätts via pro.plan.* i ordlistan. */
export interface PlanState {
  active: boolean;
  labelKey: PlanLabelKey;
  detailKey: PlanDetailKey;
  expiresAt: Date | null;
  source: string | null;
  daysLeft: number | null;
  renewing: boolean;
}

export function planState(u: PlanUser, now = new Date()): PlanState {
  const active = hasPro(u, now);
  const expiresAt = u.planExpiresAt ?? null;
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000)) : null;
  const renewing = u.planSource === "stripe" && (u.stripeSubscriptionStatus === "active" || u.stripeSubscriptionStatus === "trialing");

  if (u.role === "admin") return { active: true, labelKey: "admin", detailKey: "admin", expiresAt: null, source: "admin", daysLeft: null, renewing: false };
  if (!active) {
    const lapsed = u.plan === "pro" && expiresAt && expiresAt <= now;
    return { active: false, labelKey: "free", detailKey: lapsed ? "lapsed" : "free", expiresAt, source: u.planSource, daysLeft: null, renewing: false };
  }
  if (u.planSource === "trial") return { active: true, labelKey: "trial", detailKey: "trial", expiresAt, source: "trial", daysLeft, renewing: false };
  if (renewing) return { active: true, labelKey: "pro", detailKey: "renewing", expiresAt, source: "stripe", daysLeft, renewing: true };
  return { active: true, labelKey: "pro", detailKey: expiresAt ? "until" : "indefinite", expiresAt, source: u.planSource, daysLeft, renewing: false };
}

export interface PlanInfo extends PlanState {
  label: string;
  detail: string;
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Sätter översatt etikett och förklaring på plandatan. */
export function describePlan(state: PlanState, t: Translate, formatDate: (d: Date) => string): PlanInfo {
  const values: Record<string, string | number> = {};
  if (state.expiresAt) values.date = formatDate(state.expiresAt);
  if (state.daysLeft != null) values.days = state.daysLeft;
  return {
    ...state,
    label: t(`plan.label.${state.labelKey}`),
    detail: t(`plan.detail.${state.detailKey}`, values),
  };
}

export const PRICE_KEYS = ["monthly", "pass", "yearly"] as const;

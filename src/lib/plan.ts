import type { User } from "@/generated/prisma/client";

export type PlanUser = Pick<User, "plan" | "planExpiresAt" | "planSource" | "role" | "stripeSubscriptionStatus">;

export const TRIAL_DAYS = Math.max(0, Number(process.env.TRIAL_DAYS ?? 14) || 0);

/** Har användaren Pro just nu? Admin har alltid Pro. */
export function hasPro(u: PlanUser, now = new Date()): boolean {
  if (u.role === "admin") return true;
  if (u.plan !== "pro") return false;
  return u.planExpiresAt == null || u.planExpiresAt > now;
}

export interface PlanInfo {
  active: boolean;
  /** Kort etikett för UI */
  label: string;
  /** Förklaring */
  detail: string;
  expiresAt: Date | null;
  source: string | null;
  daysLeft: number | null;
  /** Prenumeration som förnyas automatiskt */
  renewing: boolean;
}

export function planInfo(u: PlanUser, now = new Date()): PlanInfo {
  const active = hasPro(u, now);
  const expiresAt = u.planExpiresAt ?? null;
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000)) : null;
  const renewing = u.planSource === "stripe" && (u.stripeSubscriptionStatus === "active" || u.stripeSubscriptionStatus === "trialing");

  if (u.role === "admin") return { active: true, label: "Admin", detail: "Administratörer har alltid Pro.", expiresAt: null, source: "admin", daysLeft: null, renewing: false };
  if (!active) {
    const lapsed = u.plan === "pro" && expiresAt && expiresAt <= now;
    return {
      active: false,
      label: "Gratis",
      detail: lapsed ? `Din Pro-period gick ut ${expiresAt!.toLocaleDateString("sv-SE")}.` : "Bläddra, filtrera och se din chans. Bevakningar kräver Pro.",
      expiresAt,
      source: u.planSource,
      daysLeft: null,
      renewing: false,
    };
  }
  if (u.planSource === "trial") {
    return { active: true, label: "Pro (provperiod)", detail: `Provperioden gäller ${daysLeft} ${daysLeft === 1 ? "dag" : "dagar"} till.`, expiresAt, source: "trial", daysLeft, renewing: false };
  }
  if (renewing) {
    return { active: true, label: "Pro", detail: `Förnyas automatiskt ${expiresAt ? expiresAt.toLocaleDateString("sv-SE") : ""}.`, expiresAt, source: "stripe", daysLeft, renewing: true };
  }
  return {
    active: true,
    label: "Pro",
    detail: expiresAt ? `Gäller till ${expiresAt.toLocaleDateString("sv-SE")}.` : "Gäller tills vidare.",
    expiresAt,
    source: u.planSource,
    daysLeft,
    renewing: false,
  };
}

export const PRO_FEATURES = [
  "Obegränsat antal bevakningar, även på adress och specifikt hus",
  "Mail direkt när en ny annons matchar",
  "Push-notis på dator och mobil",
  "Full notishistorik",
];

export const FREE_FEATURES = ["Alla annonser med filter, karta och sortering", "Antal annonser per kommun och stadsdel", "Chansmätare mot din egen kötid"];

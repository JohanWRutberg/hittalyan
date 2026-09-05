"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { parseFilters } from "@/lib/filters";
import { auth } from "@/lib/auth";
import { runPoll } from "@/lib/poll";
import { hasPro } from "@/lib/plan";

export type ActionState = { error?: string; ok?: boolean; summary?: string } | undefined;

// ---------- Bevakningar ----------

async function requirePro(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!hasPro(user)) redirect("/app/pro?status=required");
  return user;
}

export async function saveWatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  await requirePro(session.user.id);
  const id = String(formData.get("id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const t = await getTranslations("errors");
  if (!name) return { error: t("watchName") };

  const f = parseFilters(formData);
  const data = {
    name,
    kommuner: f.kommuner,
    stadsdelar: f.stadsdelar,
    adress: f.adress ?? null,
    minRum: f.minRum ?? null,
    maxRum: f.maxRum ?? null,
    minYta: f.minYta ?? null,
    maxYta: f.maxYta ?? null,
    minHyra: f.minHyra ?? null,
    maxHyra: f.maxHyra ?? null,
    minVaning: f.minVaning ?? null,
    maxVaning: f.maxVaning ?? null,
    balkong: f.balkong ? true : null,
    hiss: f.hiss ? true : null,
    nyproduktion: f.nyproduktion ? true : null,
    inkluderaUngdom: !!f.inkluderaUngdom,
    inkluderaStudent: !!f.inkluderaStudent,
    inkluderaSenior: !!f.inkluderaSenior,
    inkluderaKorttid: !!f.inkluderaKorttid,
    notifyEmail: formData.get("notifyEmail") === "on",
    notifyPush: formData.get("notifyPush") === "on",
  };

  if (id) {
    const existing = await prisma.watch.findFirst({ where: { id, userId: session.user.id } });
    if (!existing) return { error: t("watchNotFound") };
    await prisma.watch.update({ where: { id }, data });
  } else {
    await prisma.watch.create({ data: { ...data, userId: session.user.id } });
  }
  revalidatePath("/app/bevakningar");
  redirect("/app/bevakningar");
}

export async function toggleWatch(id: string, enabled: boolean) {
  const session = await requireSession();
  if (enabled) await requirePro(session.user.id);
  await prisma.watch.updateMany({ where: { id, userId: session.user.id }, data: { enabled } });
  revalidatePath("/app/bevakningar");
}

export async function deleteWatch(id: string) {
  const session = await requireSession();
  await prisma.watch.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/app/bevakningar");
}

// ---------- Konto ----------

export async function updateQueueDate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const raw = String(formData.get("queueRegisteredAt") ?? "").trim();
  const parsed = z.string().date().safeParse(raw);
  const date = raw ? (parsed.success ? new Date(raw + "T00:00:00Z") : null) : null;
  const t = await getTranslations("errors");
  if (raw && !date) return { error: t("dateFormat") };
  if (date && date > new Date()) return { error: t("dateFuture") };
  await prisma.user.update({ where: { id: session.user.id }, data: { queueRegisteredAt: date } });
  revalidatePath("/app/konto");
  revalidatePath("/app");
  return { ok: true };
}

export async function updateName(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const t = await getTranslations("errors");
  if (!name) return { error: t("nameMissing") };
  await prisma.user.update({ where: { id: session.user.id }, data: { name } });
  revalidatePath("/app", "layout");
  return { ok: true };
}

// ---------- Admin ----------

async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "admin") redirect("/app");
  return session;
}

export async function adminSetRole(userId: string, role: "user" | "admin") {
  const session = await requireAdmin();
  if (userId === session.user.id) return;
  await auth.api.setRole({ headers: await headers(), body: { userId, role } });
  revalidatePath("/app/admin");
}

export async function adminBan(userId: string, reason: string) {
  const session = await requireAdmin();
  if (userId === session.user.id) return;
  await auth.api.banUser({ headers: await headers(), body: { userId, banReason: reason || "Suspended by admin" } });
  revalidatePath("/app/admin");
}

export async function adminUnban(userId: string) {
  await requireAdmin();
  await auth.api.unbanUser({ headers: await headers(), body: { userId } });
  revalidatePath("/app/admin");
}

export async function adminDeleteUser(userId: string) {
  const session = await requireAdmin();
  if (userId === session.user.id) return;
  await auth.api.removeUser({ headers: await headers(), body: { userId } });
  revalidatePath("/app/admin");
}

export async function adminSetPlan(userId: string, plan: "free" | "pro", months: number | null) {
  await requireAdmin();
  const planExpiresAt = plan === "pro" && months ? new Date(Date.now() + months * 30 * 86_400_000) : null;
  await prisma.user.update({ where: { id: userId }, data: { plan, planSource: "admin", planExpiresAt } });
  revalidatePath("/app/admin");
}

export async function adminRunPoll(): Promise<ActionState> {
  await requireAdmin();
  try {
    const r = await runPoll();
    revalidatePath("/app", "layout");
    const t = await getTranslations("admin");
    return { ok: true, summary: t("summary", { total: r.total, new: r.newCount, notified: r.notified }) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

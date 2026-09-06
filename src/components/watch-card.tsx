"use client";

import Link from "next/link";
import { useTransition } from "react";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Bell, BellOff, Mail, Pencil, Trash2 } from "lucide-react";
import type { Watch } from "@/generated/prisma/client";
import { deleteWatch, toggleWatch } from "@/app/(app)/actions";
import { formatKr } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import { marketInfo, marketOf } from "@/lib/markets";

export function WatchCard({ watch: w, hits, index }: { watch: Watch; hits: number; index: number }) {
  const t = useTranslations("watches.card");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const [pending, start] = useTransition();
  // Bevakningar fortsätter notifiera även efter ett kösbyte, så staden står med.
  const info = marketInfo(marketOf(w.market));
  const parts: string[] = [];
  if (w.kommuner.length) parts.push(w.kommuner.join(", "));
  if (w.stadsdelar.length) parts.push(w.stadsdelar.join(", "));
  if (w.adress) parts.push(`"${w.adress}"`);
  if (w.minRum != null || w.maxRum != null) parts.push(t("rooms", { min: w.minRum ?? "–", max: w.maxRum ?? "–" }));
  if (w.minYta != null || w.maxYta != null) parts.push(`${w.minYta ?? "–"}–${w.maxYta ?? "–"} m²`);
  if (w.minHyra != null || w.maxHyra != null) parts.push(`${w.minHyra != null ? formatKr(w.minHyra, locale) : "–"} – ${w.maxHyra != null ? formatKr(w.maxHyra, locale) : "–"}`);
  if (w.minVaning != null || w.maxVaning != null) parts.push(t("floor", { min: w.minVaning ?? "–", max: w.maxVaning ?? "–" }));
  if (w.balkong) parts.push(t("balcony"));
  if (w.hiss) parts.push(t("elevator"));
  if (w.nyproduktion) parts.push(t("newBuild"));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`card flex flex-col gap-3 p-5 ${w.enabled ? "" : "opacity-60"} ${pending ? "animate-pulse" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-semibold">{w.name}</h3>
            <span className="chip">{info.city}</span>
          </div>
          <p className="mt-0.5 text-sm text-muted">{parts.length ? parts.join(" · ") : t("all")}</p>
        </div>
        <span className={`chip shrink-0 ${w.enabled ? "border-brand-200 bg-brand-50 text-brand-700" : ""}`}>
          {w.enabled ? t("active") : t("paused")}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1"><Mail className={`size-3.5 ${w.notifyEmail ? "text-brand-600" : "text-slate-300"}`} /> {t("mail", { state: w.notifyEmail ? t("on") : t("off") })}</span>
        <span className="inline-flex items-center gap-1"><Bell className={`size-3.5 ${w.notifyPush ? "text-brand-600" : "text-slate-300"}`} /> {t("push", { state: w.notifyPush ? t("on") : t("off") })}</span>
        <span>{t("hits", { count: hits })}</span>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
        <Link href={`/lagenheter?${w.id ? `bevakning=${w.id}` : ""}`} className="text-sm font-medium text-brand-700 hover:underline">
          {t("showHits")}
        </Link>
        <div className="flex items-center gap-1">
          <button type="button" className="btn-ghost px-2.5 py-1.5" title={w.enabled ? t("pause") : t("enable")} onClick={() => start(() => toggleWatch(w.id, !w.enabled))}>
            {w.enabled ? <BellOff className="size-4" /> : <Bell className="size-4" />}
          </button>
          <Link href={`/bevakningar/${w.id}`} className="btn-ghost px-2.5 py-1.5" title={tc("edit")}>
            <Pencil className="size-4" />
          </Link>
          <button
            type="button"
            className="btn-ghost px-2.5 py-1.5 hover:text-red-600"
            title={tc("delete")}
            onClick={() => {
              if (confirm(t("confirmDelete", { name: w.name }))) start(() => deleteWatch(w.id));
            }}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

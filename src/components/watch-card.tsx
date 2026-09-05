"use client";

import Link from "next/link";
import { useTransition } from "react";
import { motion } from "framer-motion";
import { Bell, BellOff, Mail, Pencil, Trash2 } from "lucide-react";
import type { Watch } from "@/generated/prisma/client";
import { deleteWatch, toggleWatch } from "@/app/app/actions";
import { formatKr } from "@/lib/format";

export function WatchCard({ watch: w, hits, index }: { watch: Watch; hits: number; index: number }) {
  const [pending, start] = useTransition();
  const parts: string[] = [];
  if (w.kommuner.length) parts.push(w.kommuner.join(", "));
  if (w.stadsdelar.length) parts.push(w.stadsdelar.join(", "));
  if (w.adress) parts.push(`"${w.adress}"`);
  if (w.minRum != null || w.maxRum != null) parts.push(`${w.minRum ?? "–"}–${w.maxRum ?? "–"} rum`);
  if (w.minYta != null || w.maxYta != null) parts.push(`${w.minYta ?? "–"}–${w.maxYta ?? "–"} m²`);
  if (w.minHyra != null || w.maxHyra != null) parts.push(`${w.minHyra != null ? formatKr(w.minHyra) : "–"} – ${w.maxHyra != null ? formatKr(w.maxHyra) : "–"}`);
  if (w.minVaning != null || w.maxVaning != null) parts.push(`vån ${w.minVaning ?? "–"}–${w.maxVaning ?? "–"}`);
  if (w.balkong) parts.push("balkong");
  if (w.hiss) parts.push("hiss");
  if (w.nyproduktion) parts.push("nyproduktion");

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
          <h3 className="truncate text-lg font-semibold">{w.name}</h3>
          <p className="mt-0.5 text-sm text-muted">{parts.length ? parts.join(" · ") : "Alla annonser (vanliga kön)"}</p>
        </div>
        <span className={`chip ${w.enabled ? "border-brand-200 bg-brand-50 text-brand-700" : ""}`}>
          {w.enabled ? "Aktiv" : "Pausad"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1"><Mail className={`size-3.5 ${w.notifyEmail ? "text-brand-600" : "text-slate-300"}`} /> Mail {w.notifyEmail ? "på" : "av"}</span>
        <span className="inline-flex items-center gap-1"><Bell className={`size-3.5 ${w.notifyPush ? "text-brand-600" : "text-slate-300"}`} /> Push {w.notifyPush ? "på" : "av"}</span>
        <span>· {hits} {hits === 1 ? "träff" : "träffar"} just nu</span>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
        <Link href={`/app?${w.id ? `bevakning=${w.id}` : ""}`} className="text-sm font-medium text-brand-700 hover:underline">
          Visa träffar
        </Link>
        <div className="flex items-center gap-1">
          <button type="button" className="btn-ghost px-2.5 py-1.5" title={w.enabled ? "Pausa" : "Aktivera"} onClick={() => start(() => toggleWatch(w.id, !w.enabled))}>
            {w.enabled ? <BellOff className="size-4" /> : <Bell className="size-4" />}
          </button>
          <Link href={`/app/bevakningar/${w.id}`} className="btn-ghost px-2.5 py-1.5" title="Redigera">
            <Pencil className="size-4" />
          </Link>
          <button
            type="button"
            className="btn-ghost px-2.5 py-1.5 hover:text-red-600"
            title="Ta bort"
            onClick={() => {
              if (confirm(`Ta bort bevakningen "${w.name}"?`)) start(() => deleteWatch(w.id));
            }}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

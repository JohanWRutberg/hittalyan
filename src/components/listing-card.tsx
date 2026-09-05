"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Building2, DoorOpen, Sparkles } from "lucide-react";
import type { Listing } from "@/generated/prisma/client";
import { formatDate, formatKr, formatRum, formatVaning, formatYta, isRecent } from "@/lib/format";

type ListingLike = Omit<Listing, "annonseradFran" | "annonseradTill" | "firstSeenAt" | "lastSeenAt"> & {
  annonseradFran: Date | string | null;
  annonseradTill: Date | string | null;
  firstSeenAt: Date | string;
};

export function ListingCard({ listing: l, index = 0 }: { listing: ListingLike; index?: number }) {
  const isNew = isRecent(l.firstSeenAt);
  const tags = [
    l.nyproduktion && { label: "Nyproduktion", cls: "border-amber-200 bg-amber-50 text-amber-700" },
    l.ungdom && { label: "Ungdom", cls: "" },
    l.student && { label: "Student", cls: "" },
    l.senior && { label: "Senior", cls: "" },
    l.korttid && { label: "Korttid", cls: "" },
    l.bostadssnabben && { label: "Bostadssnabben", cls: "border-sky-200 bg-sky-50 text-sky-700" },
    l.balkong && { label: "Balkong", cls: "" },
    l.hiss && { label: "Hiss", cls: "" },
  ].filter(Boolean) as { label: string; cls: string }[];

  return (
    <motion.a
      href={l.url}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 12) * 0.03, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className="card group flex flex-col gap-3 p-5 transition hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {isNew && (
              <span className="chip border-brand-200 bg-brand-50 text-brand-700">
                <Sparkles className="size-3" /> Ny
              </span>
            )}
            <span className="text-xs font-medium text-muted">
              {l.stadsdel} · {l.kommun}
            </span>
          </div>
          <h3 className="mt-1 truncate text-lg font-semibold tracking-tight text-ink group-hover:text-brand-700">{l.gatuadress}</h3>
        </div>
        <ArrowUpRight className="size-5 shrink-0 text-slate-300 transition group-hover:text-brand-600" />
      </div>

      <dl className="grid grid-cols-4 gap-2 text-sm">
        <Stat label="Rum" value={formatRum(l.antalRum).replace(" rok", "")} />
        <Stat label="Yta" value={formatYta(l.yta)} />
        <Stat label="Hyra" value={formatKr(l.hyra)} />
        <Stat label="Våning" value={formatVaning(l.vaning).replace("vån ", "")} />
      </dl>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t.label} className={`chip ${t.cls}`}>
              {t.label}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <DoorOpen className="size-3.5" /> Sista dag {formatDate(l.annonseradTill)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Building2 className="size-3.5" /> {l.koNamn ?? "Bostadskön"}
          {l.kotidQ1 != null && l.kotidQ3 != null && ` · ~${l.kotidQ1}–${l.kotidQ3} år kötid`}
        </span>
      </div>
    </motion.a>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-canvas px-2.5 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold text-ink">{value}</dd>
    </div>
  );
}

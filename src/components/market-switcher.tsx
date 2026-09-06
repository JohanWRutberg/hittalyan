"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { setMarket } from "@/lib/market-actions";
import { MarketPicker } from "@/components/market-picker";
import type { Market } from "@/lib/markets";

/** Byter kö direkt. Valet sparas på kontot för inloggade, annars i en cookie. */
export function MarketSwitcher({ current }: { current: Market }) {
  const t = useTranslations("markets");
  const router = useRouter();
  const [value, setValue] = useState<Market>(current);
  const [pending, start] = useTransition();

  return (
    <div>
      <MarketPicker
        value={value}
        disabled={pending}
        onSelect={(m) => {
          if (m === value) return;
          setValue(m);
          start(async () => {
            await setMarket(m);
            router.refresh();
          });
        }}
      />
      {pending && <p className="mt-2 text-xs text-muted">{t("switching")}</p>}
    </div>
  );
}

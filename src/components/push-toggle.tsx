"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";

type State = "unsupported" | "denied" | "off" | "on" | "loading";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function detectPushState(vapid: string | undefined): Promise<State> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !vapid) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    const sub = await reg.pushManager.getSubscription();
    return sub ? "on" : "off";
  } catch {
    return "unsupported";
  }
}

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let cancelled = false;
    detectPushState(vapid).then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, [vapid]);

  async function enable() {
    setError(null);
    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid!) });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("Kunde inte spara prenumerationen");
      setState("on");
      reg.showNotification("Ledigt", { body: "Notiser är aktiverade på den här enheten.", icon: "/icon-192.png" });
    } catch (e) {
      setError((e as Error).message);
      setState("off");
    }
  }

  async function disable() {
    setState("loading");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setState("off");
  }

  if (state === "unsupported") {
    return <p className="text-sm text-muted">Din webbläsare stöder inte push-notiser (eller VAPID-nycklar saknas i miljön).</p>;
  }
  if (state === "denied") {
    return <p className="text-sm text-red-700">Du har blockerat notiser för den här sajten. Tillåt dem i webbläsarens inställningar och ladda om.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      {state === "on" ? (
        <>
          <span className="chip border-brand-200 bg-brand-50 text-brand-700"><BellRing className="size-3.5" /> Aktiverat på den här enheten</span>
          <button type="button" onClick={disable} className="btn-secondary py-1.5 text-xs"><BellOff className="size-3.5" /> Stäng av</button>
        </>
      ) : (
        <button type="button" onClick={enable} disabled={state === "loading"} className="btn-primary">
          <Bell className="size-4" /> {state === "loading" ? "Vänta…" : "Aktivera notiser i webbläsaren"}
        </button>
      )}
      {error && <span className="text-sm text-red-700">{error}</span>}
    </div>
  );
}

import webpush from "web-push";
import { Resend } from "resend";
import type { Listing, PushSubscription as PushSub, Watch } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatKr, formatRum, formatVaning, formatYta } from "@/lib/format";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", pub, priv);
  vapidReady = true;
  return true;
}

export function listingTitle(l: Listing) {
  return `${l.gatuadress}, ${l.stadsdel} (${l.kommun})`;
}

export function listingSummary(l: Listing) {
  return [formatRum(l.antalRum), formatYta(l.yta), formatKr(l.hyra) + "/mån", formatVaning(l.vaning)].join(" · ");
}

// ---------- E-post ----------

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function renderEmailHtml(watch: Watch, listings: Listing[]) {
  const rows = listings
    .map(
      (l) => `
      <tr>
        <td style="padding:14px 16px;border-top:1px solid #e6eef2">
          <a href="${escapeHtml(l.url)}" style="font-weight:600;color:#0f766e;text-decoration:none;font-size:16px">${escapeHtml(listingTitle(l))}</a>
          <div style="color:#475569;font-size:14px;margin-top:4px">${escapeHtml(listingSummary(l))}</div>
          <div style="color:#94a3b8;font-size:12px;margin-top:4px">${l.nyproduktion ? "Nyproduktion · " : ""}${escapeHtml(l.koNamn ?? "")}${l.annonseradTill ? ` · Sista anmälningsdag ${l.annonseradTill.toISOString().slice(0, 10)}` : ""}</div>
        </td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="sv"><body style="margin:0;background:#f4f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">
    <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.08)">
      <div style="padding:24px 16px 8px">
        <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#0f766e;font-weight:700">Ledigt</div>
        <h1 style="margin:8px 0 4px;font-size:22px">${listings.length === 1 ? "Ny lägenhet" : `${listings.length} nya lägenheter`} matchar «${escapeHtml(watch.name)}»</h1>
        <p style="margin:0;color:#475569;font-size:14px">Annonserna kommer från Bostadsförmedlingen i Stockholm. Anmäl intresse snabbt, annonser ligger ofta bara ute några dagar.</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:8px">${rows}</table>
      <div style="padding:16px;border-top:1px solid #e6eef2;font-size:12px;color:#94a3b8">
        Du får detta mail eftersom du har en bevakning på <a href="${appUrl}" style="color:#0f766e">${appUrl.replace(/^https?:\/\//, "")}</a>.
        <a href="${appUrl}/app/bevakningar" style="color:#0f766e">Hantera bevakningar</a>
      </div>
    </div>
  </div>
</body></html>`;
}

export async function sendWatchEmail(to: string, watch: Watch, listings: Listing[]): Promise<boolean> {
  const subject =
    listings.length === 1
      ? `Ny lägenhet: ${listingTitle(listings[0])}`
      : `${listings.length} nya lägenheter matchar «${watch.name}»`;
  const html = renderEmailHtml(watch, listings);
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[mail:dev] Till ${to} — ${subject}\n` + listings.map((l) => `  - ${listingTitle(l)} ${l.url}`).join("\n"));
    return false;
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Ledigt <onboarding@resend.dev>",
    to,
    subject,
    html,
  });
  if (error) {
    console.error("[mail] fel:", error);
    return false;
  }
  return true;
}

// ---------- Web Push ----------

export async function sendWatchPush(subs: PushSub[], watch: Watch, listings: Listing[]): Promise<boolean> {
  if (!subs.length || !ensureVapid()) return false;
  const first = listings[0];
  const payload = JSON.stringify({
    title:
      listings.length === 1
        ? `Ny lägenhet: ${first.gatuadress}, ${first.stadsdel}`
        : `${listings.length} nya lägenheter – ${watch.name}`,
    body: listings.length === 1 ? listingSummary(first) : listings.map((l) => l.gatuadress).slice(0, 4).join(", "),
    url: listings.length === 1 ? first.url : `${appUrl}/app`,
    tag: `watch-${watch.id}`,
  });

  let anyOk = false;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 60 * 60 * 6,
        });
        anyOk = true;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
        } else {
          console.error("[push] fel:", status, (err as Error).message);
        }
      }
    }),
  );
  return anyOk;
}

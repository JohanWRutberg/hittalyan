import webpush from "web-push";
import { Resend } from "resend";
import type { Listing, PushSubscription as PushSub, Watch } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDate, formatKr, formatRum, formatVaning, formatYta } from "@/lib/format";
import { translatorFor, localeOf } from "@/i18n/messages";
import type { Locale } from "@/i18n/config";
import { marketInfo, marketOf } from "@/lib/markets";

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

export function listingSummary(l: Listing, locale: Locale, perMonth: string) {
  return [formatRum(l.antalRum, locale), formatYta(l.yta), formatKr(l.hyra, locale) + perMonth, formatVaning(l.vaning, locale)].join(" · ");
}

// ---------- E-post ----------

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function renderEmailHtml(watch: Watch, listings: Listing[], locale: Locale) {
  const t = translatorFor(locale);
  const source = marketInfo(marketOf(watch.market)).name;
  const rows = listings
    .map(
      (l) => `
      <tr>
        <td style="padding:14px 16px;border-top:1px solid #e6eef2">
          <a href="${escapeHtml(l.url)}" style="font-weight:600;color:#0f766e;text-decoration:none;font-size:16px">${escapeHtml(listingTitle(l))}</a>
          <div style="color:#475569;font-size:14px;margin-top:4px">${escapeHtml(listingSummary(l, locale, t("email.perMonth")))}</div>
          <div style="color:#94a3b8;font-size:12px;margin-top:4px">${l.nyproduktion ? `${escapeHtml(t("email.newBuild"))} · ` : ""}${escapeHtml(l.koNamn ?? "")}${
            l.annonseradTill ? ` · ${escapeHtml(t("email.lastDay", { date: formatDate(l.annonseradTill, locale) }))}` : ""
          }</div>
        </td>
      </tr>`,
    )
    .join("");

  const heading =
    listings.length === 1
      ? t("email.headingSingle", { name: watch.name })
      : t("email.headingMulti", { count: listings.length, name: watch.name });

  return `<!doctype html>
<html lang="${locale}"><body style="margin:0;background:#f4f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">
    <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.08)">
      <div style="padding:24px 16px 8px">
        <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#0f766e;font-weight:700">Hitta Lyan</div>
        <h1 style="margin:8px 0 4px;font-size:22px">${escapeHtml(heading)}</h1>
        <p style="margin:0;color:#475569;font-size:14px">${escapeHtml(t("email.lead"))}</p>
        <p style="margin:6px 0 0;color:#94a3b8;font-size:12px">${escapeHtml(t("email.source", { source }))}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:8px">${rows}</table>
      <div style="padding:16px;border-top:1px solid #e6eef2;font-size:12px;color:#94a3b8">
        ${escapeHtml(t("email.footer"))} <a href="${appUrl}" style="color:#0f766e">${appUrl.replace(/^https?:\/\//, "")}</a>.
        <a href="${appUrl}/bevakningar" style="color:#0f766e">${escapeHtml(t("email.manage"))}</a>
      </div>
    </div>
  </div>
</body></html>`;
}

export async function sendWatchEmail(to: string, watch: Watch, listings: Listing[], rawLocale?: string | null): Promise<boolean> {
  const locale = localeOf(rawLocale);
  const t = translatorFor(locale);
  const subject =
    listings.length === 1
      ? t("email.subjectSingle", { title: listingTitle(listings[0]) })
      : t("email.subjectMulti", { count: listings.length, name: watch.name });
  const html = renderEmailHtml(watch, listings, locale);
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[mail:dev] Till ${to} — ${subject}\n` + listings.map((l) => `  - ${listingTitle(l)} ${l.url}`).join("\n"));
    return false;
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Hitta Lyan <onboarding@resend.dev>",
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

export async function sendWatchPush(subs: PushSub[], watch: Watch, listings: Listing[], rawLocale?: string | null): Promise<boolean> {
  if (!subs.length || !ensureVapid()) return false;
  const locale = localeOf(rawLocale);
  const t = translatorFor(locale);
  const first = listings[0];
  // Vilken kö annonsen gäller, så att notisen går att placera direkt.
  const city = marketInfo(marketOf(watch.market)).city;
  const payload = JSON.stringify({
    title:
      listings.length === 1
        ? t("pushMsg.single", { address: `${first.gatuadress}, ${first.stadsdel}` })
        : t("pushMsg.multi", { count: listings.length, name: watch.name }),
    body: `${city} · ${listings.length === 1 ? listingSummary(first, locale, t("email.perMonth")) : listings.map((l) => l.gatuadress).slice(0, 4).join(", ")}`,
    url: listings.length === 1 ? first.url : `${appUrl}/lagenheter`,
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

// ---------- Kontaktformulär ----------

/** Adress som kontaktformuläret går till. */
export const CONTACT_EMAIL = process.env.CONTACT_EMAIL ?? "hittalyanse@gmail.com";

/**
 * Meddelande från kontaktformuläret. Avsändaren måste vara en verifierad
 * avsändaradress hos Resend, så användarens adress läggs som `replyTo`:
 * då går det att svara direkt i mailklienten.
 */
export async function sendContactEmail(opts: {
  name: string;
  email: string;
  subjectLabel: string;
  message: string;
  market: string;
  plan: string;
}): Promise<boolean> {
  const subject = `[Hitta Lyan] ${opts.subjectLabel} – ${opts.name}`;
  const rows: [string, string][] = [
    ["Namn", opts.name],
    ["E-post", opts.email],
    ["Ämne", opts.subjectLabel],
    ["Kö", opts.market],
    ["Plan", opts.plan],
  ];
  const html = `<!doctype html>
<html lang="sv"><body style="margin:0;background:#f4f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">
    <div style="background:#fff;border-radius:16px;padding:24px;box-shadow:0 1px 3px rgba(15,23,42,.08)">
      <h1 style="margin:0 0 16px;font-size:19px">${escapeHtml(opts.subjectLabel)}</h1>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding:4px 12px 4px 0;color:#64748b;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`,
          )
          .join("")}
      </table>
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e6eef2;white-space:pre-wrap;font-size:15px;line-height:1.5">${escapeHtml(opts.message)}</div>
    </div>
  </div>
</body></html>`;

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[mail:dev] Kontakt till ${CONTACT_EMAIL} — ${subject}\n${opts.message}`);
    return true; // lokalt utan nyckel räknas det som skickat, annars går formuläret aldrig att prova
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Hitta Lyan <onboarding@resend.dev>",
    to: CONTACT_EMAIL,
    replyTo: opts.email,
    subject,
    html,
  });
  if (error) {
    console.error("[mail] kontaktfel:", error);
    return false;
  }
  return true;
}

// ---------- Engångskoder (glömt lösenord, byte av e-post) ----------

export type OtpType = "sign-in" | "email-verification" | "forget-password" | "change-email";

/** Mail med en 6-siffrig kod. Koden visas stor och tydlig, aldrig som länk. */
export async function sendOtpEmail(to: string, otp: string, type: OtpType, rawLocale?: string | null): Promise<boolean> {
  const locale = localeOf(rawLocale);
  const t = translatorFor(locale);
  const kind = type === "change-email" ? "changeEmail" : type === "forget-password" ? "reset" : "verify";
  const subject = t(`otp.${kind}.subject`);

  const html = `<!doctype html>
<html lang="${locale}"><body style="margin:0;background:#f4f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px">
    <div style="background:#fff;border-radius:16px;padding:28px 24px;box-shadow:0 1px 3px rgba(15,23,42,.08)">
      <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#0f766e;font-weight:700">Hitta Lyan</div>
      <h1 style="margin:10px 0 6px;font-size:21px">${escapeHtml(t(`otp.${kind}.heading`))}</h1>
      <p style="margin:0 0 20px;color:#475569;font-size:14px">${escapeHtml(t(`otp.${kind}.lead`))}</p>
      <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:18px;text-align:center">
        <div style="font-size:34px;font-weight:700;letter-spacing:.32em;color:#0f766e;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${escapeHtml(otp)}</div>
      </div>
      <p style="margin:18px 0 0;color:#64748b;font-size:13px">${escapeHtml(t("otp.expires"))}</p>
      <p style="margin:8px 0 0;color:#94a3b8;font-size:12px">${escapeHtml(t(`otp.${kind}.ignore`))}</p>
    </div>
  </div>
</body></html>`;

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[mail:dev] Kod till ${to} (${type}): ${otp}`);
    return false;
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send({ from: process.env.EMAIL_FROM ?? "Hitta Lyan <onboarding@resend.dev>", to, subject, html });
  if (error) {
    console.error("[mail] otp-fel:", error);
    return false;
  }
  return true;
}

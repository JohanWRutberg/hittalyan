import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, emailOTP } from "better-auth/plugins";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { TRIAL_DAYS } from "@/lib/plan";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { sendOtpEmail } from "@/lib/notify";

/** E-postadresser (kommaseparerade i ADMIN_EMAILS) som automatiskt blir admin. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    changeEmail: { enabled: true },
    additionalFields: {
      queueRegisteredAt: {
        type: "date",
        required: false,
        input: true,
      },
      // Språk för gränssnitt, mail och push. Inget defaultValue här: då hade fältet
      // alltid varit ifyllt och cookie-fallbacken nedan aldrig använts. Prisma-schemat
      // har @default("sv").
      locale: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const isAdmin = adminEmails().includes(user.email.toLowerCase());
          // Nya konton får språket de registrerade sig på: fältet från formuläret,
          // annars språkcookien, annars svenska.
          const passed = (user as { locale?: string }).locale;
          let locale = isLocale(passed) ? passed : DEFAULT_LOCALE;
          if (!isLocale(passed)) {
            try {
              const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
              if (isLocale(fromCookie)) locale = fromCookie;
            } catch {
              /* utanför request-kontext: behåll standardspråket */
            }
          }
          // Ny användare får Pro som provperiod (TRIAL_DAYS, 0 stänger av)
          const trial =
            TRIAL_DAYS > 0
              ? { plan: "pro", planSource: "trial", planExpiresAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000) }
              : {};
          return { data: { ...user, locale, role: isAdmin ? "admin" : "user", ...trial } };
        },
      },
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [
    // 6-siffriga koder för glömt lösenord och byte av e-postadress.
    // Vid byte skickas koden till den NYA adressen, så den måste bevisas ägd.
    emailOTP({
      otpLength: 6,
      expiresIn: 10 * 60,
      allowedAttempts: 5,
      storeOTP: "hashed",
      // Koden går till den nya adressen, som därmed bevisas ägd. Den gamla adressen
      // behöver inte bekräfta, eftersom bytet redan kräver en inloggad session.
      changeEmail: { enabled: true, verifyCurrentEmail: false },
      async sendVerificationOTP({ email, otp, type }) {
        let locale = DEFAULT_LOCALE;
        try {
          const c = (await cookies()).get(LOCALE_COOKIE)?.value;
          if (isLocale(c)) locale = c;
        } catch {
          /* utanför request-kontext */
        }
        await sendOtpEmail(email, otp, type, locale);
      },
    }),
    admin({ defaultRole: "user" }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;

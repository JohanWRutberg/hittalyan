# Ledigt

Bevakar nya hyresrätter hos **Bostadsförmedlingen i Stockholm** (bostad.stockholm.se) och skickar mail och
push-notis så fort en annons som matchar dina kriterier publiceras. Filtrera på kommun, stadsdel, adress/hus,
antal rum, yta, hyra, våning, balkong, hiss och nyproduktion. Visar även din kötid i bostadskön.

Stack: Next.js 16 (App Router), React 19, Tailwind 4, Framer Motion, Prisma 7 + PostgreSQL, Better Auth,
Resend (mail), Web Push (VAPID). Hostas på Vercel.

## Hur det fungerar

1. `GET /api/cron/poll` hämtar `https://bostad.stockholm.se/AllaAnnonser/` (samma JSON som deras söksida använder),
   sparar nya annonser i tabellen `Listing` och avaktiverar borttagna.
2. Varje ny annons matchas mot alla aktiva **bevakningar** (`Watch`). Träff ⇒ mail via Resend och/eller push
   via Web Push. Skickade notiser loggas i `Notification` så ingen annons skickas två gånger.
3. Första körningen mot en tom databas skickar inga notiser (bara import).

## Kom igång lokalt

```bash
npm install
docker run -d --name ledigt-postgres -e POSTGRES_USER=ledigt -e POSTGRES_PASSWORD=ledigt \
  -e POSTGRES_DB=ledigt -p 5433:5432 postgres:17-alpine
cp .env.example .env          # fyll i värden, se nedan
npx prisma migrate dev        # skapar tabellerna och genererar klienten
npm run poll                  # första import av annonser
npm run dev                   # http://localhost:3000
```

Skapa ett konto med en e-post som finns i `ADMIN_EMAILS` så blir det admin automatiskt.

## Miljövariabler

| Variabel | Beskrivning |
| --- | --- |
| `DATABASE_URL` | Postgres-anslutning. Neon: `postgresql://...neon.tech/neondb?sslmode=require` |
| `BETTER_AUTH_SECRET` | Slumpad hemlighet, t.ex. `openssl rand -base64 32` |
| `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` | Sajtens publika URL, t.ex. `https://ledigt.vercel.app` |
| `CRON_SECRET` | Hemlighet som cron-anropet skickar som `Authorization: Bearer ...` |
| `RESEND_API_KEY` | API-nyckel från resend.com. Saknas den loggas mailen bara i konsolen |
| `EMAIL_FROM` | Avsändare. Utan verifierad domän: `Ledigt <onboarding@resend.dev>` (kan då bara skicka till Resend-kontots egen adress) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push-nycklar: `npx web-push generate-vapid-keys` |
| `ADMIN_EMAILS` | Kommaseparerade adresser som blir admin vid registrering |

## Deploy till Vercel

1. Skapa en Neon-databas (Vercel Marketplace → Neon, eller neon.tech) och lägg `DATABASE_URL` i Vercel.
2. Lägg in övriga miljövariabler ovan i Vercel → Settings → Environment Variables.
3. Build-kommandot kör `prisma generate` via `postinstall`. Kör migreringar mot produktion en gång:
   `DATABASE_URL=... npx prisma migrate deploy` (eller sätt build command till `prisma migrate deploy && next build`).
4. Timvis polling:
   - `vercel.json` innehåller ett cron-jobb varje hel timme. Vercel skickar automatiskt `Authorization: Bearer $CRON_SECRET`.
     **OBS:** på Hobby-planen körs Vercel-cron bara en gång per dag.
   - Därför finns `.github/workflows/poll.yml` som anropar endpointen varje timme gratis. Lägg in
     secrets `APP_URL` (t.ex. `https://ledigt.vercel.app`) och `CRON_SECRET` i GitHub-repot → Settings → Secrets.
5. Registrera dig med adressen i `ADMIN_EMAILS`. Adminportalen finns under `/app/admin`.

## Scripts

| Kommando | Gör |
| --- | --- |
| `npm run dev` | Dev-server |
| `npm run poll` | Kör en hämtning + notiser manuellt |
| `npm run db:migrate` | `prisma migrate deploy` (produktion) |
| `npm run db:studio` | Prisma Studio |

## Begränsningar

- Bostadsförmedlingen har ingen OAuth/API för "Mina sidor", så kötiden kan inte hämtas automatiskt.
  Användaren anger sitt registreringsdatum under **Konto**, och appen räknar ut år och dagar.
- `/AllaAnnonser/` är inte ett officiellt API. Om Bostadsförmedlingen ändrar formatet syns felen under Admin → Senaste hämtningar.

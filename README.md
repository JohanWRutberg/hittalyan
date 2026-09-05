# Hitta Lyan

Bevakar nya hyresrätter hos **Bostadsförmedlingen i Stockholm** (bostad.stockholm.se) och skickar mail och
push-notis så fort en annons som matchar dina kriterier publiceras. Filtrera på kommun, stadsdel, adress/hus,
antal rum, yta, hyra, våning, balkong, hiss och nyproduktion. Visar även din kötid i bostadskön.

Stack: Next.js 16 (App Router), React 19, Tailwind 4, Framer Motion, Prisma 7 + PostgreSQL, Better Auth,
Resend (mail), Web Push (VAPID), MapLibre GL + OpenFreeMap (karta, ingen API-nyckel). Hostas på Vercel.

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
| `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` | Sajtens publika URL, t.ex. `https://hittalyan.se` |
| `CRON_SECRET` | Hemlighet som cron-anropet skickar som `Authorization: Bearer ...` |
| `RESEND_API_KEY` | API-nyckel från resend.com. Saknas den loggas mailen bara i konsolen |
| `EMAIL_FROM` | Avsändare. Utan verifierad domän: `Hitta Lyan <onboarding@resend.dev>` (kan då bara skicka till Resend-kontots egen adress) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push-nycklar: `npx web-push generate-vapid-keys` |
| `ADMIN_EMAILS` | Kommaseparerade adresser som blir admin vid registrering |

## Deploy till Vercel

1. **Importera repot** på vercel.com → Add New → Project → `JohanWRutberg/hittalyan` (efter namnbytet på GitHub). Framework: Next.js (upptäcks automatiskt).
   Build-kommandot behöver inte ändras: Vercel kör `vercel-build` i package.json, som kopierar kartans worker,
   kör `prisma migrate deploy` mot produktionsdatabasen och sedan `next build`.
2. **Databas:** i projektet → Storage → Create → **Neon** (Marketplace). Neon lägger själv in `DATABASE_URL` (pooled)
   och `DATABASE_URL_UNPOOLED` (används av migreringarna) som miljövariabler.
3. **Miljövariabler:** Settings → Environment Variables → "Import .env" och klistra in innehållet i din lokala
   `.env.vercel` (skapas av utvecklaren med nya hemligheter, gitignorerad). Fyll i `RESEND_API_KEY` från resend.com.
   `BETTER_AUTH_URL` och `NEXT_PUBLIC_APP_URL` ska vara sajtens riktiga URL, t.ex. `https://hittalyan.se`.
4. **Deploya** (Deployments → Redeploy om env lades in efter första bygget). Registrera dig sedan med adressen i
   `ADMIN_EMAILS` på sajten. Kör "Hämta annonser nu" under Admin en första gång (första körningen skickar inga notiser).
5. **Polling var 30:e minut:** `vercel.json` har en daglig cron (Hobby-planen tillåter max en gång per dag; Vercel
   skickar `CRON_SECRET` automatiskt). Den täta pollningen sköts istället av `.github/workflows/poll.yml`, gratis
   eftersom Actions-minuter är obegränsade på publika repon. Lägg in två repo-secrets på GitHub → Settings →
   Secrets and variables → Actions:
   - `APP_URL` = `https://hittalyan.se` (utan avslutande snedstreck)
   - `CRON_SECRET` = samma värde som i Vercel
   Testa med Actions → "Poll Bostadsförmedlingen" → Run workflow.
6. **Resend:** skapa kontot med samma e-post som ditt admin-konto. Utan verifierad domän får `onboarding@resend.dev`
   bara skicka till den adressen, vilket räcker för eget bruk. Egen domän → byt `EMAIL_FROM`.

## Scripts

| Kommando | Gör |
| --- | --- |
| `npm run dev` | Dev-server |
| `npm run poll` | Kör en hämtning + notiser manuellt |
| `npm run db:migrate` | `prisma migrate deploy` (produktion) |
| `npm run db:studio` | Prisma Studio |

## Planer och betalning (Stripe)

- **Gratis:** bläddra, filtrera, karta, sortering, antal per område, chansmätare.
- **Pro:** bevakningar med mail och push. Nya konton får Pro som provperiod i `TRIAL_DAYS` dagar (0 stänger av).
- Admin har alltid Pro och kan ge/ta Pro manuellt i adminportalen (kronan i användarlistan).
- Stripe: skapa produkten "Hitta Lyan Pro" med tre priser (månad recurring, år recurring, 3-månaderspass one-time) och
  lägg `price_…`-ID:n i `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_PRICE_PASS`. Visningspriserna i UI:t
  styrs av `PRICE_LABEL_*`. Webhook-endpoint: `POST /api/stripe/webhook` med händelserna `checkout.session.completed`,
  `customer.subscription.created/updated/deleted` och `invoice.paid`; hemligheten i `STRIPE_WEBHOOK_SECRET`.
- Kunden hanterar kort och uppsägning via Stripe Customer Portal (knappen "Hantera betalning" under Pro). Aktivera
  portalen i Stripe Dashboard → Settings → Billing → Customer portal.
- Lokalt test: `stripe listen --forward-to localhost:3000/api/stripe/webhook` med Stripe CLI och testnycklar.

## Kartan

Lägenhetslistan visar en karta (MapLibre GL, vektorkartor från [OpenFreeMap](https://openfreemap.org), stil "Positron").
MapLibre kör tile-tolkning i en Web Worker som laddas från en separat fil. Bundlern kan inte räkna ut var den ligger,
så `scripts/copy-maplibre-worker.mjs` kopierar `maplibre-gl-worker.mjs` + `maplibre-gl-shared.mjs` till
`public/maplibre/` (körs automatiskt vid `npm install`, `npm run dev` och `npm run build`) och komponenten anropar
`setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")`. Mappen är gitignorerad.

## Begränsningar

- Bostadsförmedlingen har ingen OAuth/API för "Mina sidor", så kötiden kan inte hämtas automatiskt.
  Användaren anger sitt registreringsdatum under **Konto**, och appen räknar ut år och dagar.
- `/AllaAnnonser/` är inte ett officiellt API. Om Bostadsförmedlingen ändrar formatet syns felen under Admin → Senaste hämtningar.

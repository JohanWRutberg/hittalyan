@AGENTS.md

# Hitta Lyan

Bevakar nya hyresrätter hos Bostadsförmedlingen i Stockholm och hör av sig via mail och
push-notis så fort en annons matchar användarens filter. Drivs på hittalyan.se (Vercel).

Kommentarer och dokumentation i det här projektet skrivs på **svenska**, i klarspråk.
Användargränssnittet finns på svenska och engelska.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind 4 · Framer Motion ·
Prisma 7 + PostgreSQL (Neon i produktion) · Better Auth · next-intl · Resend ·
Web Push (VAPID) · MapLibre GL + OpenFreeMap · Stripe.

## Kommandon

| Kommando | Gör |
| --- | --- |
| `npm run dev` | Utvecklingsserver på :3000 |
| `npm run poll` | Kör en hämtning + notiser manuellt |
| `npm run db:studio` | Prisma Studio |
| `npx prisma migrate dev --name x` | Ny migrering lokalt |

Lokal databas körs i Docker: `docker start hittalyan-postgres` (port **5433**, användare,
lösenord och databas heter alla `hittalyan`).

Kör alltid `npx tsc --noEmit -p .` och `npx eslint src` innan commit. `npx next build`
fångar dessutom fel som bara syns vid produktionsbygge.

## Datakällan

Bostadsförmedlingen har inget publikt API. Vi använder samma endpoints som deras egen
webbplats anropar. De är odokumenterade och kan ändras utan förvarning:

- **`https://bostad.stockholm.se/AllaAnnonser/`** – alla aktuella annonser som JSON
  (~700 st, ~900 kB). Den gamla adressen `/Lista/AllaAnnonser` ger 404.
  Kräver `User-Agent` och `X-Requested-With: XMLHttpRequest`, se `src/lib/bostad.ts`.
- **`https://bostad.stockholm.se/SokOmraden?s=<prefix>`** – register över kommuner och
  stadsdelar. Prefixsökning, max 20 träffar per anrop. `scripts/fetch-omraden.mjs`
  räknar upp hela registret rekursivt till `src/data/omraden.json` (~840 stadsdelar).
  Behöver bara köras om när registret ändrats.

Varje annons bär `LiknadeLagenhetStatistik.KotidFordelningQ1/Q3`, alltså kvartilerna för
kötiden hos dem som fått liknande lägenheter. Det är grunden för chansmätaren.

**Var sparsam med anropen.** Var 30:e minut är avsiktligt valt, dels för Neons
CU-timmar, dels av hänsyn till en server som inte är byggd för att vara ett öppet API.

## Struktur

```
src/app/
  page.tsx              Startsida (marknadsföring)
  (app)/                Inloggat läge, delad meny
    lagenheter/         Listan (öppen även utloggad, se nedan)
    bevakningar/        Sparade filter, kräver Pro
    konto/ pro/ admin/
  (auth)/               login, register, glomt-losenord
  api/                  auth, cron/poll, push, stripe
src/lib/                Affärslogik, se nedan
src/i18n/ src/messages/ Språkstöd
```

`src/lib` i korthet: `bostad.ts` hämtar, `poll.ts` sparar och notifierar,
`matching.ts` avgör om en annons matchar en bevakning, `filters.ts` översätter
sökparametrar till Prisma-frågor, `chance.ts` bedömer chansen, `plan.ts` avgör Pro,
`notify.ts` skickar mail och push, `format.ts` formaterar per språk.

**Adresserna ligger direkt under roten.** Tidigare låg allt under `/app`, vilket såg
tråkigt ut. `next.config.ts` har permanenta omdirigeringar från de gamla adresserna,
behåll dem: hemskärmsinstallationer och bokmärken pekar dit.

## Behörighet och läge

| Läge | Ser |
| --- | --- |
| Utloggad | `/lagenheter` med karta och sidbläddring, men **24 h fördröjning** (`PUBLIC_DELAY_HOURS`) och en låst teaser som räknar de dolda. Inget filter, ingen sortering, ingen chansmätare. Parametrar i adressen ignoreras på servern. |
| Inloggad (gratis) | Allt ovan utan fördröjning, plus filter, sortering, områdesantal och chansmätare. |
| Pro | Bevakningar med mail och push. Nya konton får `TRIAL_DAYS` (14) dagar Pro. |
| Admin | Adminportal: användare, planer, avstängning, körningslogg. |

Att strypa det utloggade läget är ett medvetet val. Lätta inte på det utan att fråga.

`src/proxy.ts` gör en optimistisk cookie-koll för att slippa rendera skyddade sidor i
onödan. Den är **inte** säkerheten. Riktig kontroll sker i server components via
`requireSession()`, och Pro-kontroll via `requirePro()` i server actions.

## Better Auth

- **`Account.issuer` måste finnas i schemat.** Better Auth 1.7 skriver kolumnen, men
  deras egen schema-generator utelämnar den. Utan den kraschar registreringen.
- Roller sätts i `databaseHooks.user.create.before`: adresser i `ADMIN_EMAILS` blir admin.
  Samma hook sätter språk och provperiod.
- **Glömt lösenord och byte av e-post använder `emailOTP`-pluginet**, sexsiffriga koder
  som lever i 10 minuter och lagras hashade. Vid e-postbyte går koden till den **nya**
  adressen (`verifyCurrentEmail: false`), eftersom bytet redan kräver en inloggad session
  och poängen är att bevisa att den nya adressen ägs.
- `BETTER_AUTH_URL` måste vara exakt den adress webbläsaren faktiskt står på, alltså
  `https://www.hittalyan.se` med www. Apex omdirigerar (308) till www, och en avvikelse
  gör att Better Auths ursprungskontroll avvisar inloggningar.

## Språk

next-intl med språket i en **cookie**, inte i adressen, så alla URL:er är oförändrade.

- Ordlistor: `src/messages/sv.json` och `en.json`. **Lägg alltid till nyckeln i båda.**
- Server components: `getTranslations()`. Klientkomponenter: `useTranslations()`.
- Utanför React (mail, push, cron) finns `translatorFor(locale)` i `src/i18n/messages.ts`.
- Språket sparas även på användaren (`User.locale`) så att **mail och push** går ut på
  rätt språk, inte bara gränssnittet.
- Datum, tal och enheter formateras per språk via `src/lib/format.ts`. Använd dem,
  hårdkoda aldrig `toLocaleDateString("sv-SE")`.

## Kartan

MapLibre GL med gratis vektorkartor från OpenFreeMap (ingen API-nyckel). Tre fällor som
alla kostat tid:

1. **Worker-filen.** MapLibre startar en Web Worker från en separat fil vars adress den
   räknar ut från `import.meta.url`. Under Turbopack pekar den fel, och symtomet är
   lömskt: inga felmeddelanden, stilen laddas, men inga kartrutor hämtas och kartan
   fastnar på "Laddar karta". Därför kopierar `scripts/copy-maplibre-worker.mjs` filerna
   till `public/maplibre/` (körs vid install, dev och build) och komponenten anropar
   `setWorkerUrl()`. Rör inte det vid uppgradering utan att verifiera kartan.
2. **Containerhöjden.** MapLibres CSS sätter `position: relative` på containern och
   laddas efter Tailwind, vilket nollställer höjden om man bara använder `absolute inset-0`.
3. **Markörernas transform.** MapLibre positionerar markörer med `transform`. Animerar
   man `transform` på samma element hamnar alla markörer i ett högerhörn. Animera ett
   inre element i stället.

## Mobil

- **Menyn glider undan** vid nedåtscroll efter en tröskel och kommer tillbaka vid
  uppåtscroll (`auto-hide-header.tsx`). Den publicerar sin höjd som CSS-variabeln
  `--nav-h`.
- **Kartan är sticky** och ligger alltid på `top: 0`. Den skjuts ned med en `transform`
  lika stor som `--nav-h`. Animera aldrig `top` här: det ger layoutarbete varje bildruta
  och märkbar lagg på iPhone. Ingen `backdrop-blur` på mobil av samma skäl.
- När kartan fastnat viks dess rubrikrad ihop på mobil så att kartan ligger högst upp.
  Fastnaglingen mäts med en sentinel via `IntersectionObserver`, inte genom att läsa
  positioner under scroll.
- **Pekskärm har inget hover.** Första trycket på ett kort markerar huset på kartan,
  andra trycket öppnar annonsen. iOS simulerar `mouseenter` vid tryck, så på enheter med
  `(hover: none)` ignoreras hover-händelserna helt. Vilket kort som är "laddat" ligger i
  delad kontext (`hovered-listing.tsx`), annars räknas ett tryck på ett annat kort fel.

## Pollning

`runPoll()` hämtar allt, lägger till nya annonser, uppdaterar ändrade (kötidsstatistik
och sista dag ändras över tid), avaktiverar borttagna och notifierar matchande
bevakningar. Frågorna är batchade eftersom serverless-funktioner har kort tidsgräns.

- **Första körningen mot en tom databas skickar inga notiser.** Annars hade alla fått
  700 mail. Behåll den spärren.
- `Notification` har unikt index på `(watchId, listingId)`, så samma annons kan inte
  notifieras två gånger för samma bevakning.
- Schemat: **GitHub Actions var 30:e minut** (`.github/workflows/poll.yml`), inte Vercels
  cron, eftersom Hobby-planen bara tillåter en körning per dygn. Actions-minuter är
  gratis på publika repon. `vercel.json` har en daglig körning som skyddsnät.
- Anropet använder `curl --location`. Utan det svarar apex-domänens 308-omdirigering och
  curl skulle rapportera framgång utan att någonsin nå endpointen.
- Endpointen kräver `Authorization: Bearer $CRON_SECRET`.

## Miljövariabler

Se `.env.example` för hela listan. Värda att känna till:

`ADMIN_EMAILS` (blir admin vid registrering) · `TRIAL_DAYS` (0 stänger av provperiod) ·
`PUBLIC_DELAY_HOURS` (fördröjning för utloggade) · `CRON_SECRET` (måste matcha GitHub-
secreten `CRON_SECRET`, och `APP_URL` där ska vara `https://www.hittalyan.se`) ·
`RESEND_API_KEY` (utan den loggas mailen bara i konsolen, vilket är praktiskt lokalt).

Prismas migreringar går via `DATABASE_URL_UNPOOLED` när den finns (Neons direktanslutning),
runtime använder `DATABASE_URL` (poolad).

## Att känna till

- **Resend kan bara skicka till kontots egen adress** tills en domän verifierats i Resend.
  Andra användare får alltså inga mail förrän `hittalyan.se` är verifierad där.
- **Bostadsförmedlingen fördelar efter kötid**, inte efter vem som anmäler sig först.
  Chansmätaren bygger på det. Tätare pollning ger därför inte bättre odds.
- Kötiden kan inte hämtas automatiskt; Bostadsförmedlingen har ingen OAuth. Användaren
  anger sitt registreringsdatum själv under Konto.
- Neons gratisnivå stänger av databasen vid inaktivitet. Första anropet efter en paus tar
  några sekunder. Det är väntat, inte ett fel.
- Repot ligger på det **privata** GitHub-kontot JohanWRutberg. Datorns `gh` och HTTPS är
  inloggade som ett jobbkonto, så push måste gå via SSH (`git@github.com:...`).
  SSH-konfigurationen väljer redan rätt nyckel under `~/Repon`.

-- Notisen skrivs ned innan den skickas, och en misslyckad leverans går att göra om.
-- Tidigare skrevs raden efter sändningen och alltid som "klar": gick mailet inte fram
-- (Resend nekade adressen, nyckeln saknades, nätverket small) var notisen borta för
-- gott, eftersom annonsen inte längre är ny nästa körning.

-- Varför en kanal inte gick fram. null = levererad, eller inte begärd.
ALTER TABLE "Notification" ADD COLUMN "emailError" TEXT;
ALTER TABLE "Notification" ADD COLUMN "pushError" TEXT;

-- Antal leveransförsök. Taket i poll.ts hindrar att en död adress mals i evighet.
ALTER TABLE "Notification" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Notification" ADD COLUMN "lastTriedAt" TIMESTAMP(3);

-- Befintliga rader är redan försökta en gång, oavsett hur det gick. Utan detta
-- skulle hela historiken hamna i leveranskön vid första körningen efter uppgraderingen.
UPDATE "Notification" SET "attempts" = 1, "lastTriedAt" = "createdAt";

-- Leveranskön hämtas i tidsordning vid varje körning.
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- Notiser som inte gick att leverera syns i körningsloggen i adminportalen.
ALTER TABLE "PollRun" ADD COLUMN "notifyFailed" INTEGER NOT NULL DEFAULT 0;

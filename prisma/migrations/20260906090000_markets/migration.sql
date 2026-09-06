-- Flera bostadsförmedlingar: annonser, användare och bevakningar hör till en marknad.
-- Befintlig data är Stockholm.

-- Annonsernas id blir "<marknad>:<id hos källan>", eftersom förmedlingarna har
-- var sin id-serie i olika format (heltal, stora heltal och hexadecimala strängar).
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_listingId_fkey";

ALTER TABLE "Listing" ADD COLUMN "market" TEXT NOT NULL DEFAULT 'stockholm';
ALTER TABLE "Listing" ADD COLUMN "externalId" TEXT;
UPDATE "Listing" SET "externalId" = "id"::text;
ALTER TABLE "Listing" ALTER COLUMN "externalId" SET NOT NULL;
ALTER TABLE "Listing" ADD COLUMN "hyresvard" TEXT;
ALTER TABLE "Listing" ADD COLUMN "kotidSnitt" DOUBLE PRECISION;
ALTER TABLE "Listing" ADD COLUMN "sokande" INTEGER;
ALTER TABLE "Listing" ADD COLUMN "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Listing" ALTER COLUMN "apartmentId" DROP NOT NULL;
ALTER TABLE "Listing" ALTER COLUMN "id" TYPE TEXT USING 'stockholm:' || "id"::text;

ALTER TABLE "Notification" ALTER COLUMN "listingId" TYPE TEXT USING 'stockholm:' || "listingId"::text;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "Listing_kommun_stadsdel_idx";
DROP INDEX "Listing_active_idx";
CREATE UNIQUE INDEX "Listing_market_externalId_key" ON "Listing"("market", "externalId");
CREATE INDEX "Listing_market_kommun_stadsdel_idx" ON "Listing"("market", "kommun", "stadsdel");
CREATE INDEX "Listing_market_active_firstSeenAt_idx" ON "Listing"("market", "active", "firstSeenAt");

-- Användaren tillhör en kö, och har ett registreringsdatum per kö.
ALTER TABLE "user" ADD COLUMN "market" TEXT NOT NULL DEFAULT 'stockholm';

CREATE TABLE "UserQueue" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "registeredAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserQueue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserQueue_userId_market_key" ON "UserQueue"("userId", "market");
CREATE INDEX "UserQueue_userId_idx" ON "UserQueue"("userId");
ALTER TABLE "UserQueue" ADD CONSTRAINT "UserQueue_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "UserQueue" ("id", "userId", "market", "registeredAt", "updatedAt")
SELECT md5(random()::text || "id"), "id", 'stockholm', "queueRegisteredAt", CURRENT_TIMESTAMP
FROM "user" WHERE "queueRegisteredAt" IS NOT NULL;

ALTER TABLE "user" DROP COLUMN "queueRegisteredAt";

-- Bevakningar och körningslogg hör till en marknad.
ALTER TABLE "Watch" ADD COLUMN "market" TEXT NOT NULL DEFAULT 'stockholm';
CREATE INDEX "Watch_market_idx" ON "Watch"("market");

ALTER TABLE "PollRun" ADD COLUMN "market" TEXT NOT NULL DEFAULT 'stockholm';
CREATE INDEX "PollRun_market_startedAt_idx" ON "PollRun"("market", "startedAt");

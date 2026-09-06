-- Skilj "annonsen har inga bilder" från "vi har inte försökt hämta än".
-- Utan detta hämtades bildlösa annonser om vid varje körning, i all evighet.
ALTER TABLE "Listing" ADD COLUMN "imagesCheckedAt" TIMESTAMP(3);

-- Annonser som redan har bilder är uppenbarligen kontrollerade.
UPDATE "Listing" SET "imagesCheckedAt" = "lastSeenAt" WHERE cardinality("images") > 0;

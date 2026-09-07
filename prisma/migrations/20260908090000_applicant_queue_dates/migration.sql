-- Kötiderna för dem som faktiskt sökt annonsen. Bostadsförmedlingen i Stockholm
-- publicerar de tre längsta på annonssidan, utan inloggning.
--
-- Historiken (kotidQ1/Q3) beskriver liknande lägenheter som förmedlats tidigare,
-- inte den kö som bildats kring just den här bostaden. En attraktiv bostad drar
-- till sig sökande med betydligt längre kötid än snittet, vilket gjorde att
-- chansmätaren kunde säga "utmärkt" åt någon som låg elva i kön.
ALTER TABLE "Listing" ADD COLUMN "queueDates" TIMESTAMP(3)[] DEFAULT ARRAY[]::TIMESTAMP(3)[];
ALTER TABLE "Listing" ADD COLUMN "queueDatesAt" TIMESTAMP(3);

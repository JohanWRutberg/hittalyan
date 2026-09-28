-- Direktlänkar till objekten hos Boplats Syd och Uppsala bostadsförmedling.
--
-- Momentum-plattformen länkades förut till söklistan med rätt region förvald
-- (`/mypages/app/?region=<id>`), i tron att det inte fanns någon delbar adress per
-- annons. Den finns: `/mypages/app/visa/<id>` öppnar objektet direkt. Nya annonser
-- får rätt länk av källan; den här migreringen rättar dem som redan finns, även
-- inaktiva, så att gamla notiser och favoriter också leder rätt.
UPDATE "Listing" SET url = 'https://www.boplatssyd.se/mypages/app/visa/' || "externalId" WHERE market = 'syd';
UPDATE "Listing" SET url = 'https://www.bostad.uppsala.se/mypages/app/visa/' || "externalId" WHERE market = 'uppsala';

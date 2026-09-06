import "dotenv/config";
import { runPoll } from "../src/lib/poll";
import { marketInfo } from "../src/lib/markets";

runPoll()
  .then((r) => {
    for (const m of r.markets) {
      console.log(
        `${marketInfo(m.market).name}: ${m.total} annonser, ${m.newCount} nya, ${m.updated} uppdaterade, ` +
          `${m.deactivated} avaktiverade, ${m.notified} notiser`,
      );
    }
    for (const f of r.failed) console.error(`${marketInfo(f.market).name}: MISSLYCKADES – ${f.error}`);
    console.log(`Totalt: ${r.total} annonser, ${r.newCount} nya, ${r.notified} notiser`);
    process.exit(r.failed.length ? 1 : 0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

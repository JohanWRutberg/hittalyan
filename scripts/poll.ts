import "dotenv/config";
import { runPoll } from "../src/lib/poll";

runPoll()
  .then((r) => {
    console.log("Poll klar:", r);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

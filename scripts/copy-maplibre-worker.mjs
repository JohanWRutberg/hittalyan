// MapLibre startar sin Web Worker från en separat fil och räknar ut adressen
// från import.meta.url. Under Next/Turbopack pekar den fel, så vi serverar
// worker-filerna själva från /public/maplibre och sätter setWorkerUrl().
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules/maplibre-gl/dist");
const dest = join(root, "public/maplibre");
mkdirSync(dest, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(src, f), join(dest, f));
}
console.log("maplibre worker kopierad till public/maplibre/");

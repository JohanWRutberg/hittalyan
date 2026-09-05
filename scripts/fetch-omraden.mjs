// Hämtar Bostadsförmedlingens kompletta register över kommuner och stadsdelar
// via deras typeahead-endpoint (/SokOmraden?s=…) och sparar som src/data/omraden.json.
// Kör: node scripts/fetch-omraden.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36";
const letters = "abcdefghijklmnopqrstuvwxyzåäö".split("");
const seen = new Map();
const CAP = 20; // endpointen returnerar max 20 träffar per fråga
let requests = 0;

async function search(prefix) {
  const res = await fetch(`https://bostad.stockholm.se/SokOmraden?s=${encodeURIComponent(prefix)}`, {
    headers: { "User-Agent": UA, Accept: "application/json", "X-Requested-With": "XMLHttpRequest", Referer: "https://bostad.stockholm.se/bostad/" },
  });
  requests++;
  if (!res.ok) throw new Error(`SokOmraden ${prefix}: ${res.status}`);
  const list = await res.json();
  for (const a of list) seen.set(a.Id, a);
  // Nådde vi taket finns det troligen fler: förfina prefixet en bokstav till.
  if (list.length >= CAP && prefix.length < 4) {
    for (const l of letters) await search(prefix + l);
  }
}

for (const l of letters) await search(l);
console.log(`${requests} anrop`);

const kommuner = {};
let typer = {};
for (const a of seen.values()) {
  const [typ] = a.Id.split("-");
  typer[typ] = (typer[typ] ?? 0) + 1;
  if (typ === "Kommun") {
    kommuner[a.Namn] ??= new Set();
  } else if (typ === "Stadsdel") {
    const m = /^(.*?) - (.*)$/.exec(a.LangtNamn);
    if (!m) continue;
    (kommuner[m[1]] ??= new Set()).add(m[2]);
  }
}
const out = Object.fromEntries(
  Object.keys(kommuner)
    .sort((a, b) => a.localeCompare(b, "sv"))
    .map((k) => [k, [...kommuner[k]].sort((a, b) => a.localeCompare(b, "sv"))]),
);
const dest = join(dirname(fileURLToPath(import.meta.url)), "../src/data/omraden.json");
writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
console.log(`Sparade ${Object.keys(out).length} kommuner, ${Object.values(out).reduce((n, v) => n + v.length, 0)} stadsdelar (typer: ${JSON.stringify(typer)}) → src/data/omraden.json`);

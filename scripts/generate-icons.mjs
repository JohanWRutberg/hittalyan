/**
 * Ritar app-ikonerna och faviconen från samma källa: Lucides `building-2`, alltså
 * exakt den symbol som står i menyn och på annonser utan bild.
 *
 * Ikonerna låg tidigare som färdiga PNG:er utan något sätt att göra om dem, och
 * huset var så litet i sin platta (drygt halva bredden) att det inte gick att se
 * vad det föreställde i en flik eller på en hemskärm. Här är storleken en siffra
 * som går att ändra, och alla format ritas om i ett svep:
 *
 *   node scripts/generate-icons.mjs
 *
 * Tre saker att veta innan du ändrar `INK`:
 *
 * - **Maskerbara ikoner beskärs.** Android klipper ikonen till sin egen form –
 *   cirkel, squircle, droppe – och garanterar bara den inre cirkeln med 80 % av
 *   ikonens diameter. Därför har den maskerbara varianten mindre hus och fyller
 *   hela kvadraten med färg: rundade hörn och genomskinlighet runt om är
 *   plattformens sak, inte vår.
 * - **Faviconen får störst hus.** Den har ingen mask att ta hänsyn till, så där
 *   räknas bara läsbarheten – och i 16 px byts detaljer mot tjockare linjer.
 * - Måttet gäller husets **bläck**, inte symbolens ruta. Lucide ritar i 24×24
 *   men huset tar bara 22×20 av den, och räknar man på rutan blir huset i
 *   praktiken mindre än man bett om.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** --color-brand-600 i globals.css. Samma platta som logotypen i menyn. */
const BRAND = "#157e6c";

/** Lucide building-2 (ISC). Ritas i 24×24 med 2 enheters linjebredd. */
const PATHS = [
  "M10 12h4",
  "M10 8h4",
  "M14 21v-3a2 2 0 0 0-4 0v3",
  "M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",
  "M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16",
];

/**
 * Husets bläck i symbolens koordinater: x 1–23, y 2–22 med linjebredden inräknad,
 * alltså 22×20 i en ruta på 24×24, med mitten i (12, 12).
 */
const INK_W = 22;
const INK_CX = 12;
const INK_CY = 12;

/** Hur stor andel av ikonens bredd huset tar. */
const INK = {
  /** Vanlig app-ikon och favicon i menyn: så stort det går utan att kännas trångt. */
  standard: 0.64,
  /** Maskerbar: ryms i den inre cirkeln på 80 % även med hörnen inräknade. */
  maskable: 0.54,
  /** Favicon i 32 och 48 px, där huset fortfarande går att läsa. */
  favicon: 0.72,
  /**
   * Favicon i 16 px. Där finns ingen detaljrikedom att hämta: linjerna hamnar
   * mellan bildpunkter och gråsuddas. Lite mindre hus med tydligt tjockare
   * linjer läser bäst av det som går att få – provat mot 0,72/2, 0,64/2,8 och
   * 0,60/3,2, som antingen suddas ut eller växer ihop till en klump.
   */
  favicon16: 0.68,
};

/** Linjebredd i symbolens koordinater. Lucide ritar med 2. */
const STROKE = { normal: 2, favicon16: 2.4 };

function svg({ size, ink, radius, stroke = STROKE.normal }) {
  const scale = (size * ink) / INK_W;
  const tx = size / 2 - INK_CX * scale;
  const ty = size / 2 - INK_CY * scale;
  const plate =
    radius > 0
      ? `<rect width="${size}" height="${size}" rx="${size * radius}" fill="${BRAND}"/>`
      : `<rect width="${size}" height="${size}" fill="${BRAND}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${plate}
  <g transform="translate(${tx} ${ty}) scale(${scale})" fill="none" stroke="#ffffff" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">
    ${PATHS.map((d) => `<path d="${d}"/>`).join("\n    ")}
  </g>
</svg>`;
}

const png = (opts) => sharp(Buffer.from(svg(opts))).png().toBuffer();

/**
 * ICO är en enkel behållare: rubrik, en post per storlek, och sedan bilderna som
 * de är. Vi lägger in PNG:er, vilket alla webbläsare sedan Vista klarar.
 */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserverat
  header.writeUInt16LE(1, 2); // 1 = ikon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // antal färger i paletten: 0 = fler än 256
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4); // färgplan
    e.writeUInt16LE(32, 6); // bitar per bildpunkt
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const out = [];

for (const size of [192, 512]) {
  out.push([`public/icon-${size}.png`, await png({ size, ink: INK.standard, radius: 0.22 })]);
}
out.push(["public/icon-512-maskable.png", await png({ size: 512, ink: INK.maskable, radius: 0 })]);
/*
 * iOS lägger sin egen rundning över hela kvadraten, och målar genomskinliga
 * bildpunkter svarta. En ikon med egna rundade hörn fick därför svarta hörn på
 * hemskärmen – apple-ikonen ritas ut i kanterna, utan rundning.
 */
out.push(["public/apple-icon.png", await png({ size: 180, ink: INK.standard, radius: 0 })]);
out.push([
  "src/app/favicon.ico",
  ico(
    await Promise.all(
      [16, 32, 48].map(async (size) => ({
        size,
        data: await png({
          size,
          ink: size === 16 ? INK.favicon16 : INK.favicon,
          stroke: size === 16 ? STROKE.favicon16 : STROKE.normal,
          radius: 0.2,
        }),
      })),
    ),
  ),
]);

for (const [path, data] of out) {
  await mkdir(dirname(join(ROOT, path)), { recursive: true });
  await writeFile(join(ROOT, path), data);
  console.log(`${path} (${(data.length / 1024).toFixed(1)} kB)`);
}

/**
 * Generates the Moneo PWA icon set + favicons + social card from the
 * brand mark at public/brand/moneo-mark-1200.png (and logo for OG).
 *
 * Outputs:
 *   public/favicon-32.png
 *   public/favicon.png
 *   public/favicon-180.png
 *   public/favicon.ico
 *   public/apple-touch-icon.png
 *   public/icon-192.png
 *   public/icon-512.png
 *   public/icon-maskable-512.png
 *   public/og.png
 *
 * Usage: node scripts/generate-icons.mjs
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'public');
const MARK = join(OUT, 'brand', 'moneo-mark.svg');

await mkdir(OUT, { recursive: true });

/** Brand obsidian plate — matches public/brand/moneo-mark.svg and the app background. */
const PLATE = { r: 7, g: 11, b: 20, alpha: 1 };

/** The mark is a vector: rasterise it crisp at any target size. */
const markSharp = () => sharp(MARK, { density: 1200 });

async function sampleBg() {
  return PLATE;
}

async function writeResized(name, size) {
  const file = join(OUT, name);
  await markSharp()
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(file);
  console.log(`✓ ${name} (${size}×${size})`);
}

/**
 * Maskable icons need ~20% safe padding around the glyph.
 * Full-bleed plate + inset mark.
 */
async function writeMaskable(name, size) {
  const pad = Math.round(size * 0.18);
  const inner = size - pad * 2;
  const bg = await sampleBg();
  const inset = await markSharp()
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: inset, left: pad, top: pad }])
    .png()
    .toFile(join(OUT, name));
  console.log(`✓ ${name} (${size}×${size}, maskable)`);
}

/** 1200×630 social card: obsidian plate + geometric mark + "Moneo" wordmark + tagline. */
async function writeOg() {
  const W = 1200;
  const H = 630;
  const markSize = 300;
  const markBuf = await markSharp()
    .resize(markSize, markSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const textSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="300">
      <text x="0" y="132" font-family="Inter, Helvetica, Arial, sans-serif" font-size="128" font-weight="800" fill="#f2f6ff" letter-spacing="-3">Moneo</text>
      <text x="4" y="196" font-family="Inter, Helvetica, Arial, sans-serif" font-size="34" font-weight="600" fill="#7dd3fc">Plan. Focus. Move. Grow.</text>
      <text x="4" y="248" font-family="Inter, Helvetica, Arial, sans-serif" font-size="26" font-weight="500" fill="#93a7c6">One system instead of four apps · moneo.bond</text>
    </svg>`,
  );

  const markLeft = 130;
  const markTop = Math.round((H - markSize) / 2);
  const textLeft = 490;
  const textTop = Math.round((H - 300) / 2);

  await sharp({
    create: { width: W, height: H, channels: 4, background: PLATE },
  })
    .composite([
      { input: markBuf, left: markLeft, top: markTop },
      { input: textSvg, left: textLeft, top: textTop },
    ])
    .png()
    .toFile(join(OUT, 'og.png'));
  console.log(`✓ og.png (${W}×${H})`);
}

/** Minimal ICO containing a single 32×32 PNG (Vista+ / modern browsers). */
async function writeIco() {
  const png = await readFile(join(OUT, 'favicon-32.png'));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(1, 4); // count

  const entry = Buffer.alloc(16);
  entry[0] = 32; // width
  entry[1] = 32; // height
  entry[2] = 0; // color count
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bit count
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(6 + 16, 12); // offset to PNG

  await writeFile(join(OUT, 'favicon.ico'), Buffer.concat([header, entry, png]));
  console.log('✓ favicon.ico (32×32 PNG)');
}

await writeResized('favicon-32.png', 32);
await writeResized('favicon.png', 32);
await writeResized('favicon-180.png', 180);
await writeResized('apple-touch-icon.png', 180);
await writeResized('icon-192.png', 192);
await writeResized('icon-512.png', 512);
await writeMaskable('icon-maskable-512.png', 512);
await writeOg();
await writeIco();

console.log('Icons written to public/ from brand mark.');

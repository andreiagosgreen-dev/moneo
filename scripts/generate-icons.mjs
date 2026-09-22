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
const MARK = join(OUT, 'brand', 'moneo-mark-1200.png');
const LOGO = join(OUT, 'brand', 'moneo-logo-1200.png');

await mkdir(OUT, { recursive: true });

/** Sample a near-edge pixel so OG / maskable bg matches the mark plate. */
async function sampleBg(path) {
  const { data } = await sharp(path)
    .ensureAlpha()
    .extract({ left: 8, top: 8, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { r: data[0], g: data[1], b: data[2], alpha: 1 };
}

async function writeResized(name, size, { fit = 'cover' } = {}) {
  const file = join(OUT, name);
  await sharp(MARK).resize(size, size, { fit, position: 'centre' }).png().toFile(file);
  console.log(`✓ ${name} (${size}×${size})`);
}

/**
 * Maskable icons need ~20% safe padding around the glyph.
 * Full-bleed plate from mark bg + inset mark.
 */
async function writeMaskable(name, size) {
  const pad = Math.round(size * 0.18);
  const inner = size - pad * 2;
  const bg = await sampleBg(MARK);
  const inset = await sharp(MARK)
    .resize(inner, inner, { fit: 'cover', position: 'centre' })
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

/** 1200×630 social card: dark plate + mark + centered wordmark from logo. */
async function writeOg() {
  const W = 1200;
  const H = 630;
  const bg = await sampleBg(MARK);
  const markSize = 360;
  const markBuf = await sharp(MARK)
    .resize(markSize, markSize, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  // Logo is square (mark + wordmark on cream). Crop lower third ≈ wordmark,
  // then flatten onto the dark plate so we avoid a cream box.
  const logoMeta = await sharp(LOGO).metadata();
  const lw = logoMeta.width ?? 1200;
  const lh = logoMeta.height ?? 1200;
  const cropTop = Math.round(lh * 0.62);
  const cropH = Math.max(1, lh - cropTop);
  const wordW = 420;
  const wordH = Math.round((wordW * cropH) / lw);
  const wordBuf = await sharp(LOGO)
    .extract({ left: 0, top: cropTop, width: lw, height: cropH })
    .resize(wordW, wordH, { fit: 'fill' })
    .ensureAlpha()
    // Drop near-cream pixels so only the green wordmark remains.
    .raw()
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => {
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Cream / paper plate → transparent
        if (r > 220 && g > 210 && b > 190) {
          data[i + 3] = 0;
          continue;
        }
        // Dark forest wordmark → soft cream so it reads on the dark plate
        const ink = 1 - (r + g + b) / (3 * 255);
        data[i] = 238;
        data[i + 1] = 241;
        data[i + 2] = 232;
        data[i + 3] = Math.round(Math.min(255, data[i + 3] * (0.35 + ink * 0.65)));
      }
      return sharp(data, {
        raw: { width: info.width, height: info.height, channels: 4 },
      })
        .png()
        .toBuffer();
    });

  const markLeft = 140;
  const markTop = Math.round((H - markSize) / 2);
  const wordLeft = 560;
  const wordTop = Math.round((H - wordH) / 2);

  await sharp({
    create: { width: W, height: H, channels: 4, background: bg },
  })
    .composite([
      { input: markBuf, left: markLeft, top: markTop },
      { input: wordBuf, left: wordLeft, top: wordTop },
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

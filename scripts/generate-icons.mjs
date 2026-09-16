/**
 * Generates the Moneo PWA icon set (PNG) + social card onto public/.
 *
 * The mascot is the favicon design: a dark rounded square, a cream progress
 * ring (the growth ring), an arrow, and the tomato accent dot.
 *
 * Outputs:
 *   public/icon-192.png            — standard PWA icon
 *   public/icon-512.png            — high-res PWA icon
 *   public/icon-maskable-512.png   — safe-zone maskable icon (full-bleed bg)
 *   public/apple-touch-icon.png    — iOS home-screen icon (180×180)
 *   public/og.png                  — 1200×630 social share card
 *
 * Usage: node scripts/generate-icons.mjs
 */

import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'public');
await mkdir(OUT, { recursive: true });

const BG = '#0d1310';
const CREAM = '#eef1e8';
const RING_COLOR = '#3ddc97';
const ACCENT = '#ff6242';

/** The mascot at viewBox 0 0 32 32, on a transparent canvas. */
function mascotSvg(maskable = false) {
  const rect = maskable
    ? '<rect width="32" height="32" fill="' + BG + '"/>'
    : '<rect width="32" height="32" rx="8" fill="' + BG + '"/>';
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    rect +
    '<circle cx="16" cy="16" r="10.5" fill="none" stroke="' +
    RING_COLOR +
    '" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="49.5 16.5" transform="rotate(-40 16 16)"/>' +
    '<path d="M11 20.5V12.8L16 17.3L21 12.8V20.5" fill="none" stroke="' +
    CREAM +
    '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="23.4" cy="8.6" r="2.1" fill="' +
    ACCENT +
    '"/>' +
    '</svg>'
  );
}

/** Wide social card: the mascot left, a calm glow, tagline blocks (no text). */
function ogSvg() {
  const W = 1200;
  const H = 630;
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
    W +
    ' ' +
    H +
    '">' +
    '<rect width="' +
    W +
    '" height="' +
    H +
    '" fill="' +
    BG +
    '"/>' +
    '<rect width="' +
    W +
    '" height="' +
    H +
    '" fill="url(#g)"/>' +
    '<defs><radialGradient id="g" cx="0.2" cy="0.15" r="0.9">' +
    '<stop offset="0" stop-color="#1a241d"/>' +
    '<stop offset="1" stop-color="#0d1310"/>' +
    '</radialGradient></defs>' +
    '<g transform="translate(120,315)" opacity="0.18">' +
    '<circle r="300" fill="none" stroke="' +
    RING_COLOR +
    '" stroke-width="3"/>' +
    '</g>' +
    '<g transform="translate(120,315)">' +
    '<circle r="120" fill="none" stroke="' +
    RING_COLOR +
    '" stroke-width="26" stroke-linecap="round" stroke-dasharray="565 190" transform="rotate(-40)"/>' +
    '<path d="M66 250V140L120 194L174 140V250" fill="none" stroke="' +
    CREAM +
    '" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="196" cy="96" r="26" fill="' +
    ACCENT +
    '"/>' +
    '</g>' +
    '<rect x="340" y="250" width="430" height="26" rx="13" fill="' +
    CREAM +
    '" opacity="0.95"/>' +
    '<rect x="340" y="320" width="300" height="22" rx="11" fill="' +
    CREAM +
    '" opacity="0.45"/>' +
    '<rect x="340" y="366" width="360" height="22" rx="11" fill="' +
    CREAM +
    '" opacity="0.3"/>' +
    '</svg>'
  );
}

async function writePng(name, svg, width, height, density) {
  const file = join(OUT, name);
  await sharp(Buffer.from(svg), { density })
    .resize(width, height, { fit: 'cover', position: 'entropy' })
    .png()
    .toFile(file);
  console.log(`✓ ${name} (${width}×${height})`);
}

await writePng('icon-192.png', mascotSvg(false), 192, 192, 96);
await writePng('icon-512.png', mascotSvg(false), 512, 512, 256);
await writePng('icon-maskable-512.png', mascotSvg(true), 512, 512, 256);
await writePng('apple-touch-icon.png', mascotSvg(false), 180, 180, 90);
await writePng('og.png', ogSvg(), 1200, 630, 144);

console.log('Icons written to public/.');
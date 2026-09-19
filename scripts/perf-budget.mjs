/**
 * Bundle size gate (Roadmap Faza 1.3). Runs after `vite build` and fails
 * closed (exit 1) when the largest JS chunk in dist/assets exceeds the
 * gzip budget — the same 500 kB threshold Vite itself warns about, so a
 * regression like the one found in the 2026-09-17/18 audits (main chunk
 * silently growing from 530 kB to 636 kB between two audits) breaks CI
 * instead of shipping unnoticed.
 *
 * Measures gzip size directly (not raw bytes) since that is what actually
 * crosses the network to a user's device.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'dist', 'assets');
const BUDGET_GZIP_BYTES = 250 * 1024;

function findJsFiles(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => path.join(dir, name));
}

let files;
try {
  files = findJsFiles(ASSETS_DIR);
} catch {
  console.error(`perf-budget: could not read ${ASSETS_DIR} — run "vite build" first.`);
  process.exit(1);
}

if (files.length === 0) {
  console.error(`perf-budget: no JS chunks found in ${ASSETS_DIR}.`);
  process.exit(1);
}

const sized = files
  .map((file) => {
    const raw = readFileSync(file);
    const gzip = gzipSync(raw).length;
    return { file: path.basename(file), raw: raw.length, gzip };
  })
  .sort((a, b) => b.gzip - a.gzip);

const worst = sized[0];
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

console.log('perf-budget: largest chunks (gzip)');
for (const { file, gzip } of sized.slice(0, 5)) {
  console.log(`  ${kb(gzip).padStart(9)}  ${file}`);
}

if (worst.gzip > BUDGET_GZIP_BYTES) {
  console.error(
    `\nperf-budget: FAIL — ${worst.file} is ${kb(worst.gzip)} gzip, over the ${kb(BUDGET_GZIP_BYTES)} budget.`,
  );
  console.error(
    'Code-split the new weight (lazy import, move it under an already-lazy tab/card, or ' +
      'give it its own dynamic import) instead of raising this budget.',
  );
  process.exit(1);
}

console.log(`\nperf-budget: OK — largest chunk ${kb(worst.gzip)} gzip, budget ${kb(BUDGET_GZIP_BYTES)}.`);

#!/usr/bin/env node
/**
 * Performance budget gate (Roadmap Faza 1.3).
 *
 * Run after `vite build`. Fails CI if the gzipped main JavaScript chunk
 * is larger than the configured budget. Keeps the entry bundle honest
 * without micro-managing every asset.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_BYTES = 250 * 1024;
const ASSETS_DIR = join(process.cwd(), 'dist', 'assets');

function main() {
  let files;
  try {
    files = readdirSync(ASSETS_DIR);
  } catch (err) {
    console.error(`perf-budget: could not read ${ASSETS_DIR} — run build first`);
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const mainChunk = files.find((name) => /^index-[A-Za-z0-9_-]+\.js$/.test(name));
  if (!mainChunk) {
    console.error('perf-budget: no main JS chunk found in dist/assets');
    process.exit(1);
  }

  const raw = readFileSync(join(ASSETS_DIR, mainChunk));
  const gzipped = gzipSync(raw);

  console.log(
    `perf-budget: ${mainChunk} raw=${raw.length} gzip=${gzipped.length} budget=${BUDGET_BYTES}`,
  );

  if (gzipped.length > BUDGET_BYTES) {
    console.error(
      `perf-budget: FAIL main chunk gzip (${gzipped.length} B) exceeds budget (${BUDGET_BYTES} B)`,
    );
    process.exit(1);
  }

  console.log('perf-budget: OK');
}

main();

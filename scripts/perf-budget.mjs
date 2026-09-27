#!/usr/bin/env node
/**
 * Performance budget gate (Roadmap Faza 1.3).
 *
 * Run after `vite build`. Fails CI if a gzipped critical JavaScript chunk
 * is larger than the configured budget: the entry (everyone, incl. the
 * first-visit landing page) and the app shell `AppRoot` (loaded right away
 * for returning users). Keeps both honest without micro-managing every asset.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_BYTES = 250 * 1024;
const ASSETS_DIR = join(process.cwd(), 'dist', 'assets');
const CHUNKS = [
  { label: 'main', pattern: /^index-[A-Za-z0-9_-]+\.js$/ },
  { label: 'app shell', pattern: /^AppRoot-[A-Za-z0-9_-]+\.js$/ },
];

function main() {
  let files;
  try {
    files = readdirSync(ASSETS_DIR);
  } catch (err) {
    console.error(`perf-budget: could not read ${ASSETS_DIR} — run build first`);
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  let failed = false;
  for (const { label, pattern } of CHUNKS) {
    const chunk = files.find((name) => pattern.test(name));
    if (!chunk) {
      console.error(`perf-budget: no ${label} JS chunk found in dist/assets`);
      process.exit(1);
    }

    const raw = readFileSync(join(ASSETS_DIR, chunk));
    const gzipped = gzipSync(raw);

    console.log(
      `perf-budget: ${chunk} raw=${raw.length} gzip=${gzipped.length} budget=${BUDGET_BYTES}`,
    );

    if (gzipped.length > BUDGET_BYTES) {
      console.error(
        `perf-budget: FAIL ${label} chunk gzip (${gzipped.length} B) exceeds budget (${BUDGET_BYTES} B)`,
      );
      failed = true;
    }
  }

  if (failed) process.exit(1);
  console.log('perf-budget: OK');
}

main();

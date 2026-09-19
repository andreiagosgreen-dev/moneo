/**
 * Uploads the built SPA (dist/) to the Cloudflare R2 bucket that backs the
 * Moneo worker, preserving relative paths so asset lookups resolve.
 *
 * Uses the `wrangler` binary from cloudflare/workers (its own package.json),
 * so install that first (`npm ci` in cloudflare/workers).
 *
 * Auth: `wrangler login` locally, or CLOUDFLARE_API_TOKEN +
 * CLOUDFLARE_ACCOUNT_ID in CI.
 *
 * Usage: node scripts/deploy-assets.mjs
 */

import { readdir, stat, existsSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BUCKET = process.env.R2_BUCKET_NAME || 'moneo-assets';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const DIST = join(repoRoot, 'dist');

// Resolve the worker-local wrangler (cross-platform: .cmd on Windows).
const binDir = join(repoRoot, 'cloudflare', 'workers', 'node_modules', '.bin');
function wranglerBin() {
  const name = process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler';
  const base = join(binDir, name);
  return existsSync(base) ? base : 'wrangler';
}
const WRANGLER = wranglerBin();

async function walk(dir) {
  const entries = await readdir(dir);
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const info = await stat(full);
    if (info.isDirectory()) {
      files.push(...(await walk(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

const files = await walk(DIST);

for (const file of files) {
  const key = relative(DIST, file).split(sep).join('/').replace(/\\/g, '/');
  const command = `${WRANGLER} r2 object put ${BUCKET}/${key} --file "${file}"`;
  console.log(`→ ${key}`);
  execSync(command, { stdio: 'inherit', bigint: false });
}

console.log(`\nUploaded ${files.length} files to r2://${BUCKET}`);
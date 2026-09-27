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

import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
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

/**
 * Upload order matters: hashed assets first, shell last.
 * If index.html / sw.js land before their hashed chunks exist on R2, the
 * Worker historically SPA-fell-back HTML for missing `.js` → black screen.
 */
function uploadRank(key) {
  if (key === 'index.html') return 3;
  if (key === 'sw.js' || key === 'registerSW.js' || /^workbox-.*\.js$/.test(key)) return 2;
  if (key.startsWith('assets/')) return 0;
  return 1;
}

const ordered = [...files].sort((a, b) => {
  const ka = relative(DIST, a).split(sep).join('/').replace(/\\/g, '/');
  const kb = relative(DIST, b).split(sep).join('/').replace(/\\/g, '/');
  return uploadRank(ka) - uploadRank(kb) || ka.localeCompare(kb);
});

for (const file of ordered) {
  const key = relative(DIST, file).split(sep).join('/').replace(/\\/g, '/');
  const command = `${WRANGLER} r2 object put ${BUCKET}/${key} --file "${file}" --remote`;
  console.log(`→ ${key}`);
  execSync(command, { stdio: 'inherit', bigint: false });
}

console.log(`\nUploaded ${ordered.length} files to r2://${BUCKET}`);

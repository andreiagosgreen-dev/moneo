/**
 * Uploads the built SPA (dist/) to the Cloudflare R2 bucket that backs the
 * Moneo worker, preserving relative paths so asset lookups resolve.
 *
 * Fast path: a manifest of content hashes (`_deploy/manifest.json` in the
 * bucket) records what is already there, so only new or changed files are
 * uploaded — usually a few dozen instead of ~650. Uploads run in parallel,
 * in rank order (hashed assets → other files → service worker → index.html),
 * and each one retries on transient Cloudflare errors.
 *
 * Uses the `wrangler` binary from cloudflare/workers (its own package.json),
 * so install that first (`npm ci` in cloudflare/workers).
 *
 * Auth: `wrangler login` locally, or CLOUDFLARE_API_TOKEN +
 * CLOUDFLARE_ACCOUNT_ID in CI.
 *
 * Usage: node scripts/deploy-assets.mjs            (changed files only)
 *        FULL_UPLOAD=1 node scripts/deploy-assets.mjs   (everything)
 *        DRY_RUN=1 node scripts/deploy-assets.mjs       (only report what would upload)
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, sep, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const BUCKET = process.env.R2_BUCKET_NAME || 'moneo-assets';
const MANIFEST_KEY = '_deploy/manifest.json';
const CONCURRENCY = Number(process.env.UPLOAD_CONCURRENCY) || 8;
const ATTEMPTS = 4;
const FULL = process.env.FULL_UPLOAD === '1';
const DRY_RUN = process.env.DRY_RUN === '1';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const DIST = join(repoRoot, 'dist');

// Resolve the worker-local wrangler (cross-platform: .cmd on Windows).
const binDir = join(repoRoot, 'cloudflare', 'workers', 'node_modules', '.bin');
const isWin = process.platform === 'win32';
function wranglerBin() {
  const base = join(binDir, isWin ? 'wrangler.cmd' : 'wrangler');
  return existsSync(base) ? base : 'wrangler';
}
const WRANGLER = wranglerBin();

function wrangler(args) {
  // .cmd shims need a shell on Windows; quote paths for it.
  const quoted = isWin ? args.map((a) => (/[\s"]/.test(a) ? `"${a}"` : a)) : args;
  return run(WRANGLER, quoted, { shell: isWin, maxBuffer: 16 * 1024 * 1024 });
}

async function withRetry(label, fn) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= ATTEMPTS) throw err;
      const wait = 1500 * attempt;
      console.warn(`  ↻ ${label} failed (attempt ${attempt}/${ATTEMPTS}), retrying in ${wait}ms`);
      await sleep(wait);
    }
  }
}

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry);
    if ((await stat(full)).isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

const keyOf = (file) => relative(DIST, file).split(sep).join('/').replace(/\\/g, '/');

/**
 * Upload order matters: hashed assets first, shell last.
 * If index.html / sw.js land before their hashed chunks exist on R2, the
 * Worker historically SPA-fell-back HTML for missing `.js` → black screen.
 */
export function uploadRank(key) {
  if (key === 'index.html') return 3;
  if (key === 'sw.js' || key === 'registerSW.js' || /^workbox-.*\.js$/.test(key)) return 2;
  if (key.startsWith('assets/')) return 0;
  return 1;
}

/** Files whose hash differs from (or is missing in) the previous manifest. */
export function changedKeys(current, previous) {
  return Object.keys(current).filter((key) => previous[key] !== current[key]);
}

async function readRemoteManifest() {
  if (FULL) return {};
  const dir = await mkdtemp(join(tmpdir(), 'moneo-deploy-'));
  const file = join(dir, 'manifest.json');
  try {
    await wrangler([
      'r2',
      'object',
      'get',
      `${BUCKET}/${MANIFEST_KEY}`,
      '--file',
      file,
      '--remote',
    ]);
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    return parsed && typeof parsed.files === 'object' ? parsed.files : {};
  } catch {
    console.log('No previous deploy manifest — uploading everything.');
    return {};
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function uploadAll(keys, files) {
  let index = 0;
  let done = 0;
  const worker = async () => {
    while (index < keys.length) {
      const key = keys[index++];
      await withRetry(key, () =>
        wrangler(['r2', 'object', 'put', `${BUCKET}/${key}`, '--file', files[key], '--remote']),
      );
      done += 1;
      console.log(`→ ${key}  (${done}/${keys.length})`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, keys.length) }, worker));
}

async function main() {
  const started = Date.now();
  const all = await walk(DIST);
  const files = {};
  const hashes = {};
  for (const file of all) {
    const key = keyOf(file);
    files[key] = file;
    hashes[key] = createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
  }

  const previous = await readRemoteManifest();
  const changed = changedKeys(hashes, previous);
  console.log(`${changed.length} of ${all.length} files changed since the last deploy.`);
  if (DRY_RUN) {
    for (const key of changed.slice(0, 20)) console.log(`  would upload ${key}`);
    if (changed.length > 20) console.log(`  … and ${changed.length - 20} more`);
    return;
  }

  // One rank at a time, in parallel inside each rank.
  for (const rank of [0, 1, 2, 3]) {
    const batch = changed.filter((k) => uploadRank(k) === rank).sort();
    if (batch.length) await uploadAll(batch, files);
  }

  // Record what is live now (last, so a failed deploy re-uploads next time).
  const dir = await mkdtemp(join(tmpdir(), 'moneo-deploy-'));
  const manifestFile = join(dir, 'manifest.json');
  await writeFile(manifestFile, JSON.stringify({ at: new Date().toISOString(), files: hashes }));
  await withRetry(MANIFEST_KEY, () =>
    wrangler([
      'r2',
      'object',
      'put',
      `${BUCKET}/${MANIFEST_KEY}`,
      '--file',
      manifestFile,
      '--remote',
    ]),
  );
  await rm(dir, { recursive: true, force: true });

  const secs = Math.round((Date.now() - started) / 1000);
  console.log(
    `\nUploaded ${changed.length} changed files (${all.length} total) to r2://${BUCKET} in ${secs}s`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err?.stderr || err?.message || err);
    process.exit(1);
  });
}

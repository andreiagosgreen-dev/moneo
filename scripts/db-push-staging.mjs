#!/usr/bin/env node
/**
 * Push local migrations (supabase/migrations, in 0001→N order) to the
 * STAGING Supabase project. Production pushes stay in CI
 * (.github/workflows/supabase-migrations.yml) behind the `production`
 * environment gate — staging first, always.
 *
 * Requires SUPABASE_STAGING_PROJECT_REF + SUPABASE_ACCESS_TOKEN (in the
 * environment or in .env.local, which is gitignored).
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function envValue(name) {
  if (process.env[name]) return process.env[name];
  const p = join(process.cwd(), '.env.local');
  if (!existsSync(p)) return null;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === name) return m[2].trim().replace(/^"|"$/g, '');
  }
  return null;
}

const ref = envValue('SUPABASE_STAGING_PROJECT_REF');
if (!ref) {
  console.error('db:push:staging: set SUPABASE_STAGING_PROJECT_REF (env or .env.local) first');
  process.exit(1);
}
if (!/^[a-z0-9-]{5,40}$/.test(ref)) {
  console.error('db:push:staging: SUPABASE_STAGING_PROJECT_REF looks invalid');
  process.exit(1);
}
if (!envValue('SUPABASE_ACCESS_TOKEN')) {
  console.error('db:push:staging: SUPABASE_ACCESS_TOKEN is required for the CLI');
  process.exit(1);
}

const res = spawnSync(
  'npx',
  ['--yes', 'supabase@latest', 'db', 'push', '--project-ref', ref, ...process.argv.slice(2)],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);
process.exit(res.status ?? 1);

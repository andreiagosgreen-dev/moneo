/**
 * Minimal secret scanner (Faza 5A). Runs in CI on every PR and locally via
 * `npm run secret-scan`. Fails closed (exit 1) on any high-signal finding.
 *
 * Scope is deliberately tight to stay noise-free: private key blocks, JWTs
 * outside tests/docs, assigned webhook-secret literals, and committed
 * dotenv files (only .env.example may be tracked). Lockfiles, vendored
 * deps and build output are never scanned.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  '.wrangler',
  '.vscode',
  '.opencode',
  'coverage',
]);
const SKIP_FILES = new Set(['package-lock.json']);
const MAX_BYTES = 1_000_000;

const TEXT_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.yml',
  '.yaml',
  '.toml',
  '.sql',
  '.md',
  '.html',
  '.css',
  '.txt',
  '.example',
  '.sh',
  '.ps1',
]);

/** Files where key-shaped fixtures are expected (tests, docs, examples). */
const isFixture = (rel) =>
  rel.endsWith('.test.ts') ||
  rel.endsWith('.test.tsx') ||
  rel.endsWith('.example') ||
  rel.includes('SECURITY.md');

const PATTERNS = [
  {
    name: 'private-key-block',
    re: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
    fixturesOk: false,
  },
  {
    name: 'jwt',
    re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    fixturesOk: true,
  },
  {
    name: 'lemon-squeezy-secret-literal',
    re: /LEMON_SQUEEZY_WEBHOOK_SECRET\s*=\s*['"][^'"]+['"]/,
    fixturesOk: false,
  },
  {
    name: 'supabase-service-key-literal',
    re: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/,
    fixturesOk: false,
  },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (st.isFile() && st.size <= MAX_BYTES) {
      if (SKIP_FILES.has(entry)) continue;
      if (!TEXT_EXT.has(path.extname(entry).toLowerCase())) continue;
      out.push(full);
    }
  }
  return out;
}

const findings = [];

// 1. Content patterns.
for (const full of walk(ROOT)) {
  const rel = path.relative(ROOT, full).replace(/\\/g, '/');
  let text;
  try {
    text = readFileSync(full, 'utf8');
  } catch {
    continue;
  }
  for (const { name, re, fixturesOk } of PATTERNS) {
    if (fixturesOk && isFixture(rel)) continue;
    if (re.test(text)) findings.push(`${name}: ${rel}`);
  }
}

// 2. Committed dotenv files (only *.example may be tracked).
try {
  const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n');
  for (const f of tracked) {
    const base = path.basename(f);
    if (/^\.env($|\.[^.]+$)/.test(base) && !base.endsWith('.example')) {
      findings.push(`tracked-dotenv: ${f}`);
    }
  }
} catch {
  findings.push('scan-error: git ls-files failed');
}

if (findings.length > 0) {
  console.error(`secret-scan: ${findings.length} finding(s):`);
  for (const f of findings) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('secret-scan: clean');

#!/usr/bin/env node
/**
 * DNS + edge health check for moneo.bond (CI gate, post-deploy verification).
 *
 * Validates, in order:
 *   1. DNS: moneo.bond resolves (CNAME target optionally enforced via
 *      EXPECT_CNAME, e.g. "moneo.workers.dev" while the custom domain migrates).
 *   2. Edge: the site is served through Cloudflare (cf-ray header present).
 *   3. HTTP: /, /manifest.webmanifest and /sw.js all answer 200.
 *
 * Exits non-zero with a readable report on any failure — safe to wire into
 * GitHub Actions as a deploy gate or a scheduled monitor.
 */

import { resolve4, resolveCname } from 'node:dns/promises';

const DOMAIN = process.env.CHECK_DOMAIN || 'moneo.bond';
const EXPECT_CNAME = process.env.EXPECT_CNAME || null;

const failures = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => {
  console.log(`  ✗ ${msg}`);
  failures.push(msg);
};

async function main() {
  console.log(`check-dns: ${DOMAIN}`);

  // 1. DNS resolution
  let ips = [];
  let cnames = [];
  try {
    cnames = await resolveCname(DOMAIN);
    ok(`CNAME: ${cnames.join(', ') || '(none — proxied A record)'}`);
  } catch {
    ok('CNAME: (none — proxied A record)');
  }
  try {
    ips = await resolve4(DOMAIN);
    ok(`A: ${ips.join(', ')}`);
  } catch (err) {
    bad(`DNS A lookup failed: ${err.message}`);
  }
  if (ips.length === 0) bad('DNS returned no A records');
  if (EXPECT_CNAME && !cnames.some((c) => c.toLowerCase().includes(EXPECT_CNAME.toLowerCase()))) {
    bad(`CNAME target mismatch — expected "${EXPECT_CNAME}", got ${cnames.join(', ') || '(none)'}`);
  }

  // 2 + 3. HTTP probes through the edge
  const probes = ['/', '/manifest.webmanifest', '/sw.js'];
  for (const path of probes) {
    const url = `https://${DOMAIN}${path}`;
    try {
      const res = await fetch(url, { redirect: 'manual' });
      const cfRay = res.headers.get('cf-ray');
      if (!cfRay) bad(`${path}: no cf-ray header — not served by Cloudflare?`);
      if (res.status !== 200) {
        bad(`${path}: expected 200, got ${res.status}`);
        continue;
      }
      ok(`${path}: 200${cfRay ? ` (cf-ray ${cfRay.split(' ')[0]})` : ''}`);
    } catch (err) {
      bad(`${path}: request failed — ${err.message}`);
    }
  }

  if (failures.length > 0) {
    console.error(`check-dns: FAIL (${failures.length} issue(s))`);
    process.exit(1);
  }
  console.log('check-dns: OK');
}

main();

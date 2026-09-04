# Moneo Recovery Baseline (Gate 13/13B)

## Recovery record

- **Recovery date:** 2026-09-04
- **Project path:** `/workspace`
- **Recovery source:** session tool-record (Source #4) — no git history, snapshot,
  or remote was available at recovery time. Every file was recreated from the
  verified Gate 9 baseline authored and build-proven earlier in this session.
- **Candidate status:** VERIFIED GREEN (typecheck + 191/191 tests + production build)
- **Durable commit:** PENDING — a git repository exists on disk
  (`master` @ `d30f855821f93ca29c4923e57be4d5b96b2b17b2`, created by the
  environment; contents unverified), but no shell/git command execution is
  available in this environment, so the recovery commit and tag could not be
  created here. No remote is configured.

## Commands to finalize the durable baseline (first shell-enabled session)

```sh
cd /workspace
git status --short                 # expect only intended files
git diff --check
git add -A
git commit -m "recovery: restore verified Moneo sync baseline"
git tag -a moneo-recovered-gate13b -m "Verified Gate 9 recovery baseline: 191/191 tests, build green"
git rev-parse moneo-recovered-gate13b
git status --short                 # expect clean
# then configure + push to an authorized remote (REMOTE BACKUP REQUIRED)
```

## Validation results (executed 2026-09-04)

- **Typecheck:** PASS (`tsc --noEmit`, strict)
- **Test files:** 13
- **Tests:** 191 passed / 191 total, 0 failed
- **Build:** PASS — 94 modules
  - initial JS 175.23 kB (gzip 46.31 kB)
  - lazy Supabase chunk 213.39 kB (gzip 66.66 kB)
  - CSS 29.43 kB (gzip 6.96 kB)
- **Node/npm:** node v22.23.2 / npm 10.9.8 (from npm debug log)
- **Security scan:** no service-role keys, no billing secrets, no hardcoded
  credentials in `src/`, `supabase/`, or `docs/`

## Storage schema

- `CURRENT_SCHEMA_VERSION = 2`
- Keys (pinned by tests):
  - `solanum:settings`, `solanum:history`, `solanum:snapshot` (legacy, preserved)
  - `moneo:intention-draft`, `moneo:focus-areas`, `moneo:selected-focus-area`,
    `moneo:schema-version`, `moneo:sync-state`

## Recovered feature families

- **Core:** Moneo branding, timestamp-accurate timer (Focus / Short / Long),
  start/pause/reset/skip, keyboard controls, chime, settings, stats, streak,
  daily goal, 7-day chart, responsive layout (320 px+)
- **Product:** Growth (history-derived), Focus Intentions, Focus Areas
  (soft-delete), Session Log
- **Data:** storage adapter, schema migrations (v0→v1→v2, id backfill),
  timezone abstraction + tz-aware stats, stable session ids
- **Cloud:** Supabase env seam (lazy SDK), auth controller/provider,
  profile/session/area/settings repositories, first-sync consent, sync state
  + device id, merge planners, sync engine (fake-cloud tested: idempotence,
  two-device convergence, conflict policy, privacy boundaries)
- **SQL:** `supabase/migrations/0001_core_schema.sql` (4 tables, RLS, FK
  SET NULL area semantics), `supabase/tests/0001_rls.test.sql` (14 planned
  pgTAP assertions — AUTHORED, NOT EXECUTED)

## Known missing work (Gates 10–12, intentionally NOT recovered)

- Area UUID cloud mapping / migration
- Production pagination beyond the documented 20k cap
- Account deletion flow
- Free/Pro entitlements (`src/lib/entitlements.ts`, `src/lib/env.ts`)
- Billing schema (0002), `checkout-create` + `lemon-squeezy-webhook` functions
- Legal pages (Privacy / Terms), deploy runbook, production headers/config
- Live Mode Lemon Squeezy configuration
- DNS/deployment for moneo.bond

These are absent on disk by design; their prior reports were never backed by
executable verification and are withdrawn.

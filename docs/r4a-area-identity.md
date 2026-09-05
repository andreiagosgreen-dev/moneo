# R4A: account-scoped cloud area identity

Starting commit: `7d28a833cb43f150496455e25a2c1b04d09bb489` on `main`,
also tagged `moneo-r3-verified`. Preflight: clean working tree, TypeScript
passed, 15 files / 254 tests passed, production build passed.

## Boundary trace and root cause

| Boundary | Identity |
| --- | --- |
| Local area | `FocusArea.id` is permanent local identity; `cloudId` is the persisted cloud UUID |
| Local session | `session.areaId` references the local area ID |
| Area planner before R4A | Compared local `id` with remote UUID `id` |
| Area planner after R4A | Projects local `cloudId ?? id`, matching remote `id` within the selected account; operations retain local `areaId` for application |
| Cloud area | `(user_id, id)` is the relational primary key |
| Cloud session | `(user_id, area_id)` references the same owner's area |
| Session upload | Engine translates a copy to cloud UUID; repository sends owner plus UUID |
| Session adoption/conflict | Engine resolves cloud UUID back to the existing local ID; remote-only custom areas use UUID as local ID |

The exact Gate 0 fixture (`area:work` plus its seeded cloud UUID, matching
remote Work) previously produced one false insert and one false adoption.
It now produces one noop and neither false operation. With a newer renamed
remote Work, the planner applies the remote payload to `area:work` instead
of creating another area.

## Why a composite key

Account-derived UUIDs would require translating existing cloud identities
or maintaining another identity mapping. The existing local v3 data and
remote UUIDs can be preserved by making their existing account scope part
of the actual database key instead.

Devices of one account share seeded UUIDs and therefore upsert the same
`(user_id, id)` rows. Another account can use the identical seeded UUIDs
under a different owner. The composite FK also rejects references to an
area owned only by another user, independently of RLS visibility.

Migration `0002_user_scoped_area_identity.sql` retains migration 0001 and
does not rewrite rows. It replaces the area PK and session area FK in one
transaction. Validation aborts and rolls back if existing cross-owner
references violate the new FK. No automatic deletion or nulling of such
legacy data is performed. Existing ownership policies remain in force.

`ON DELETE SET NULL (area_id)` preserves session ownership and history;
only the deleted area reference becomes null. This requires PostgreSQL 15+.
Soft deletion keeps both identities and stamps `updated_at` and `deleted_at`.
The repository uses `onConflict: "user_id,id"`; delete requests filter by
both owner and UUID. The sync engine uploads areas before dependent sessions.
Local schema remains v3; historical local references are not converted.

## Executable coverage

`src/lib/sync/areaIdentity.integration.test.ts` adds 19 cases, using PGlite
0.5.8 (PostgreSQL in WASM, dev-only). The test transport implements the
Supabase query shape but executes the real repositories' rows, filters,
ordering, ranges and conflict targets against the actual migrations.
Results cross a JSON boundary, matching PostgREST timestamp representation.
Queries run as a non-owner role with the original RLS policies; the test
provides a minimal local `auth.users` and JWT-subject `auth.uid()` shim.

Coverage includes all three seeds, custom UUID/non-UUID local IDs, rename,
delete/restore, remote adoption, local push, same-user two-device and
different-user sync, session/Growth preservation, R2 area conflicts, R3
later pages, second/third zero-write syncs, parent-before-child upload,
failure/retry, and data-preserving migration / invalid-data rollback.

`supabase/tests/0002_area_identity.test.sql` runs inside the suite. It tests
scoped uniqueness, owner-specific session references, FK rejection on
cross-owner insert/update, RLS read/write isolation, and owner-preserving
hard delete. It uses SQL exceptions instead of depending on pgTAP helpers.

Run on Node 26 in PowerShell:

```powershell
$env:NODE_OPTIONS = '--no-experimental-webstorage'
npm run typecheck
npm run test:run
npm run build
git diff --check
```

## Rollout and limits

- Apply 0002 before deploying the new client conflict target. Older clients
  using `onConflict: "id"` are incompatible with the new composite PK;
  a coordinated client rollout is necessary. No remote migration was run.
- PostgreSQL constraints/RLS were tested locally. Supabase Auth, PostgREST
  HTTP behavior and a hosted project's migration compatibility were not
  verified. Docker was unavailable; no live Supabase project was contacted.
- The legacy `0001_rls.test.sql` pgTAP artifact was not executed by this suite.
- This remediation does not repair previously duplicated local area entries.
- Separate Gate 0 gaps remain: production local-write failure propagation,
  React state refresh after sync, and installation-scoped consent metadata.
- Session IDs retain their existing global primary key; this change scopes
  area identity and the session-to-area FK, not session identity itself.
- RANGE/OFFSET concurrency risk and the Node 26 test workaround remain.

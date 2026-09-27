# Moneo Security (Faza 5A)

Defense-in-depth: no single layer (frontend, one rule, one secret) is the
only protection. The app fails closed, stays updatable, and limits blast
radius. Last reviewed with the 5A hardening pass; re-checked against
Supabase's security/performance advisors on 2026-09-20 (migrations 0007,
0008 — see "Maintenance" below).

## Data map

| Data                                                                         | Where it lives           | Server access                                                              |
| ---------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------- |
| Timer history, projects, tasks, habits, rituals, Life Map, settings UI state | `localStorage` first     | Only `focus_sessions`, `focus_areas`, `user_settings` sync (owner RLS)     |
| Profile, timezone                                                            | Supabase `profiles`      | Owner CRUD via RLS                                                         |
| Subscription status/plan                                                     | Supabase `subscriptions` | **SELECT-only** for clients; writes only via webhook with service-role key |
| Billing events                                                               | Lemon Squeezy → Worker   | HMAC-verified, allowlisted, deduped                                        |
| Account deletion                                                             | Worker, JWT-verified     | Service-role key, never exposed to client                                  |

Life Map, journal, energy log and i18n choice are **local-only by design**:
no server table exists for them, so there is nothing to leak server-side.
`localStorage` is convenient, not encrypted — we prevent XSS (CSP below,
no `dangerouslySetInnerHTML`, escaped report HTML) instead of claiming
local encryption that does not exist.

**BYOK Assistant keys** (optional): the user's Gemini / OpenAI / DeepSeek
key stays in `localStorage` (`moneo:ai-byok`) and is sent **only** from the
browser to that provider (header auth; never logged, never to Moneo
workers). Production CSP `connect-src` allowlists those three API hosts.
Prefer the server `/api/ai/plan` path (`AI_API_KEY` Worker secret) when you
do not want a provider key in the browser at all.

## Edge (Cloudflare Worker)

- **Headers on every response** (`cloudflare/workers/security.ts`): strict
  CSP (`default-src 'self'`, fonts/Supabase/Lemon Squeezy allowlisted,
  BYOK provider hosts for optional client keys,
  `frame-ancestors 'none'`, no `unsafe-inline`/`unsafe-eval`),
  `nosniff`, strict referrer policy, minimal permissions policy
  (microphone intentionally allowed — voice input is a feature),
  HSTS, `X-Frame-Options: DENY` as legacy backup.
  Custom-domain self-hosted Supabase needs its host added to `connect-src`.
- **CORS** is origin-allowlisted, never `*`.
- **Webhook** (`/api/webhook/lemonsqueezy`): fails closed without the HMAC
  secret; 1 MB body cap; lifecycle-event allowlist; same
  (event, subscription) applies once per hour (replay best-effort);
  idempotent upsert; upstream errors are generic (no echoed bodies).
- **Rate limits** (per-isolate, best-effort): 30 req/min/IP webhook,
  10 req/min/IP account deletion, HTTP 429 + `Retry-After`.
- **Account deletion**: identity only from the caller JWT verified against
  Supabase Auth; client-supplied ids ignored; tables wiped in dependency
  order before the Auth user.

## Client input handling

- Task links: `safeExternalUrl()` allows only absolute `http(s)` (bare
  domains upgrade to https); anything else stays inert text. Opening uses
  `window.open(url, '_blank', 'noopener,noreferrer')` + `opener = null`.
- CSV export: OWASP formula-injection guard (leading `= + - @` prefixed
  with `'`); quotes still escaped.
- Checkout URLs: configured base must parse as `https:` or no URL is built.
- Printable reports escape HTML (`&lt;script&gt;` covered by test).
- Checkout/user ids are URL-encoded; webhook attributes by subscription id.

## Auth model

- Pro status is **read** from the `subscriptions` row (server truth) and
  only gates UI; it never grants data access — RLS does.
- No client-decided roles, plans, or Auth deletion. Sensitive operations
  (delete user, billing, email) run server-side with platform-env secrets.
- Re-authentication: Supabase password reconfirmation is not yet wired
  before account deletion; deletion requires a valid session plus an
  explicit typed/confirmed UI step. Tracked as a pre-launch item.

## Secrets

- `.env.example` holds placeholders only; real `.env*` files must never be
  committed (`secret-scan` fails CI if one is tracked).
- No secret in Vite output, Git, console logs or error payloads.
- `npm run secret-scan` (CI on every PR): private-key blocks, JWT-shaped
  strings outside tests, assigned webhook/service-key literals.
- `npm run audit` (`npm audit --audit-level=high`, clean at 5A).

## Maintenance

- CI per PR: prettier check, eslint, `tsc`, full vitest, `vite build`,
  `npm audit`, `secret-scan`. Dependabot: npm weekly (max 3 open),
  GitHub Actions monthly.
- Structural RLS tests (`rls-migrations.test.ts`) reject broad policies
  before they can merge; live RLS/billing/deletion E2E still requires a
  staging project (pre-launch item, Week 11).
- Billing CHECK constraints (`0006`) bound status/plan to known values.
- Run Supabase's `get_advisors` (security + performance) after any DDL
  change, not just at launch — it catches things structural tests can't
  see (e.g. a function accidentally exposed as a public RPC). 2026-09-20
  pass: `0007` revoked the public/anon/authenticated EXECUTE grant
  PostgREST had auto-added for `rls_auto_enable()` (an event-trigger
  function Postgres already refuses to call directly, but the exposed
  RPC endpoint was still unnecessary surface); `0008` rewrote all 15
  owner-scoped RLS policies to call `(select auth.uid())` instead of
  `auth.uid()` directly, so Postgres evaluates it once per query
  instead of once per row (same access rules, faster at scale). Still
  open: enable **Leaked Password Protection** in the Supabase dashboard
  (Authentication → Sign In / Providers) — not settable via SQL/API.

## Backups & restore

- **Supabase**: enable Point-in-Time Recovery on the project (daily base +
  WAL); before risky ops take an explicit SQL dump (`supabase db dump`).
- **Local-first data**: CSV export (Reports) + printable PDF are the user
  escape hatch; clearing history is locked while sync is on.
- **Restore**: (1) restore project to PITR point or replay dump into a
  fresh project, (2) re-apply `supabase/migrations` in order,
  (3) rotate `SUPABASE_SERVICE_ROLE_KEY` + webhook secret,
  (4) verify login → sync → billing status for a test user.
- Verify restores quarterly; document the result next to this file.

## Residual risks (accepted, tracked)

- Rate limits/dedup are per-isolate, not global — provider WAF rules are
  still recommended at launch.
- No CSP `report-uri` yet — add with a collector before public launch.
- No E2E suite yet (needs staging + browsers); unit + structural coverage
  is green (see `build:ci`).
- AI companion (Faza 6) must add: server-side calls only, minimal context,
  explicit consent, rate/cost caps, audit trail.

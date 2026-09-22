# LAUNCH-9 — checklist zi-cu-zi

**Ghid complet (pas cu pas, azi):** [`OPS-LAUNCH.md`](./OPS-LAUNCH.md)  
**Regula:** niciun checkout inventat, niciun DSN fals, niciun commit fara cerere.

---

## Eu am facut in repo (agent)

| Item | Stare |
|---|---|
| Checkout Lemon fail-closed + preturi $5.99 / $59.99 | OK |
| Worker webhook HMAC + portal + rate-limit + CORS | OK |
| Migratii Supabase 0001–0006 + workflow staging→prod | OK |
| Stub Sentry (`VITE_SENTRY_DSN` + boot, fail-closed) | OK |
| `.env.example` documenteaza Vite + Worker secrets (comentarii) | OK |
| CI deploy R2/Worker, DNS check, Dependabot, secret-scan | OK |
| Turnstile in app | Nu (anti-bot = CF dashboard) |
| Ghid ops | `OPS-LAUNCH.md` |

---

## Tu faci acum (browser / CLI) — ordine

1. **Conturi:** Supabase (staging+prod), Cloudflare, Lemon, Sentry, GitHub env `production`
2. **Supabase:** URL+anon in `.env.local`; Auth Site URL `https://moneo.bond` + redirect `/**` + localhost; `npm run db:push:staging` (sau workflow migratii)
3. **Cloudflare secrets** (`cd cloudflare/workers`):
   - `wrangler secret put SUPABASE_URL`
   - `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`
   - `wrangler secret put LEMON_SQUEEZY_WEBHOOK_SECRET`
   - `wrangler secret put LEMON_SQUEEZY_API_KEY`
4. **Anti-bot (rapid):** CF → Security → Bot Fight Mode ON; WAF managed ON; SSL Full (strict) + Always HTTPS
5. **Lemon:** produse Monthly $5.99 / Yearly $59.99 → 4x `VITE_LEMONSQUEEZY_*`; webhook `https://moneo.bond/api/webhook/lemonsqueezy` + acelasi signing secret
6. **GitHub secrets:** `VITE_SUPABASE_*`, `VITE_LEMONSQUEEZY_*`, `CLOUDFLARE_*`, `SUPABASE_*` migratii
7. **Deploy:** Actions → CI → workflow_dispatch pe `main` (approval) SAU build local + `deploy-assets` + `wrangler deploy` + `node scripts/check-dns.mjs`
8. **Sentry:** proiect React → `npm i @sentry/react` → `VITE_SENTRY_DSN` → rebuild
9. **Smoke:** HTTPS moneo.bond → auth+sync → checkout real → rand `subscriptions` → portal; UAT scurt din `docs/UAT.md`

---

## Ce li pestesti minim in `.env.local`

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_LEMONSQUEEZY_STORE_ID=
VITE_LEMONSQUEEZY_CHECKOUT_URL=
VITE_LEMONSQUEEZY_MONTHLY_VARIANT_ID=
VITE_LEMONSQUEEZY_YEARLY_VARIANT_ID=
VITE_SENTRY_DSN=
SUPABASE_STAGING_PROJECT_REF=
SUPABASE_ACCESS_TOKEN=
```

Worker (doar `wrangler secret put`, niciodata VITE): `SUPABASE_SERVICE_ROLE_KEY`, `LEMON_SQUEEZY_WEBHOOK_SECRET`, `LEMON_SQUEEZY_API_KEY`.

Email (`VITE_EMAIL_API_URL`) poate astepta — UI e fail-closed.
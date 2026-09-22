# OPS-LAUNCH — ghid pas cu pas (azi)

**Scop:** pune pe picioare Supabase + Cloudflare (+ anti-bot) + Lemon Squeezy + Sentry + securitate/mentenanta, in ordinea dependentelor.

**Regula:** nicio cheie reala in Git. Nu inventa secrete. Commit doar daca ceri explicit.

---

## Legenda — cine face ce

| Marcaj | Semnificatie |
|---|---|
| **[REPO]** | Deja facut in cod / documentat acum (nu mai trebuie reinventat) |
| **[TU]** | Actiuni in browser / dashboard / CLI pe masina ta |

Ghid detaliat: acest fisier. Checklist scurt: `LAUNCH-9.md`. Securitate: `SECURITY.md`. Deploy lung: `DEPLOYMENT.md`.

---

## Stare reala din repo (citita acum)

| Componenta | Stare |
|---|---|
| Checkout Lemon (FE) | **[REPO]** `buildCheckoutUrl` fail-closed; nevoie de 4x `VITE_LEMONSQUEEZY_*` + HTTPS |
| Webhook Lemon | **[REPO]** Worker `POST /api/webhook/lemonsqueezy` — HMAC, rate-limit 30/min/IP, dedupe, fail-closed fara secret |
| Customer Portal | **[REPO]** `GET /api/billing/portal` — JWT Supabase + `LEMON_SQUEEZY_API_KEY` pe Worker |
| Migratii Supabase | **[REPO]** `0001`…`0006` (inclusiv `subscriptions` + CHECK-uri) |
| Rate-limit API Worker | **[REPO]** webhook/API 30/min/IP; delete account 10/min/IP (per-isolate) |
| CORS | **[REPO]** allowlist; default `https://moneo.bond` |
| Sentry FE | **[REPO]** stub `src/lib/sentry.ts` + `initSentry()` in `main.tsx`; **lipseste** `@sentry/react` in package.json |
| Email | **[REPO]** fail-closed (`sendEmailNotification` nu trimite); fara backend |
| Turnstile / captcha in app | **Nu exista** → anti-bot = Cloudflare dashboard (faza 1); Turnstile pe auth = faza 2 optionala |
| Domeniu | **[REPO]** `wrangler.toml` → `moneo.bond`; R2 `moneo-assets`; KV legat |
| CI | **[REPO]** lint + build:ci + audit + secret-scan; deploy pe `workflow_dispatch` + env `production`; DNS check la 6h; Dependabot |

---

## Ordinea zilei (dependente)

```
1 Conturi
2 Supabase (proiecte + Auth redirect + migratii)
3 Cloudflare (wrangler + secrets Worker + anti-bot dashboard)
4 GitHub secrets (build Vite) + environment production
5 Lemon Squeezy (produse + webhook + API key)
6 Deploy SPA + Worker
7 Sentry
8 Verificare (health, UAT smoke, billing test)
9 Mentenanta (backups, Dependabot, email mai tarziu)
```

---

## PASUL 0 — Conturi **[TU]**

1. https://supabase.com — 2 proiecte: `moneo-staging`, `moneo` (prod)
2. https://dash.cloudflare.com — domeniul `moneo.bond` pe acelasi account ca Worker-ul
3. https://lemonsqueezy.com — store
4. https://sentry.io — org + proiect React
5. GitHub repo → Settings → Environments → creeaza **`production`** cu required reviewers

---

## PASUL 1 — Supabase **[TU]**

### 1.1 Proiecte

1. **New Project** → `moneo-staging`, regiune apropiata, salveaza DB password.
2. Repeta pentru `moneo` (production). **Reference ID-urile trebuie sa fie diferite.**

### 1.2 URL + anon key

Project Settings → API (fiecare proiect):

- Project URL → `VITE_SUPABASE_URL`
- anon public → `VITE_SUPABASE_ANON_KEY`
- **service_role** → NU in Vite / GitHub `VITE_*`. Doar Worker: `SUPABASE_SERVICE_ROLE_KEY`.

### 1.3 Auth redirect

Authentication → URL Configuration:

| Camp | Valoare |
|---|---|
| Site URL (prod) | `https://moneo.bond` |
| Redirect URLs | `https://moneo.bond/**`, `http://localhost:5173/**` |

Staging: poti dezactiva Confirm email (Auth → Providers → Email) pentru UAT fara inbox.

### 1.4 Migratii

Fisiere: `supabase/migrations/0001_…` → `0006_…`.

**Local staging:**

1. Access Token: supabase.com → Account → Access Tokens
2. In `.env.local`:

```
SUPABASE_STAGING_PROJECT_REF=<Reference ID>
SUPABASE_ACCESS_TOKEN=<token>
```

3. `npm run db:push:staging`

**CI (prod):** GitHub secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_STAGING_PROJECT_REF`, `SUPABASE_PRODUCTION_PROJECT_REF` → Actions → Supabase migrations → dry_run pe staging, apoi apply `both` (prod cere approval).

### 1.5 Sanity RLS

SQL Editor staging:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
select policyname, tablename, cmd from pg_policies where schemaname = 'public' order by 1,2;
```

Asteptat: `subscriptions` RLS ON, policy SELECT own; scrieri doar via Worker (service role).

Verificare: sign-up → Cont → Sync → fara 401/RLS in Network.

---

## PASUL 2 — Cloudflare **[TU]** (+ anti-bot)

### 2.1 CLI

```powershell
cd c:\Users\Andrei\Desktop\programm\moneo\cloudflare\workers
npm ci
npx wrangler login
```

### 2.2 Resurse denumite in repo **[REPO]**

- Worker: `moneo`; domain: `moneo.bond`; R2: `moneo-assets`; KV: `KV_CACHE`

### 2.3 Secrets Worker

```powershell
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put LEMON_SQUEEZY_WEBHOOK_SECRET
npx wrangler secret put LEMON_SQUEEZY_API_KEY
# optional: npx wrangler secret put AI_API_KEY
```

CORS default = `https://moneo.bond`. Pentru local+prod: `CORS_ORIGINS=https://moneo.bond,http://localhost:5173`

### 2.4 Anti-bot dashboard (faza 1 — fara cod) **[TU]**

Turnstile **nu** e in app. Rapid:

1. Security → Bots → **Bot Fight Mode** ON
2. Security → WAF → Managed rules ON; optional Rate limiting pe `/api/*`
3. SSL/TLS → **Full (strict)**; Always Use HTTPS ON
4. Security Level: Medium (sau High daca e abuz)

**Faza 2 (optional):** Turnstile pe formulare Auth — doar daca spam pe sign-up e real. Nu pe checkout Lemon.

### 2.5 Token deploy GitHub

CF API Token (Workers + R2 pe `moneo-assets`) → secrets `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`.

---

## PASUL 3 — Lemon Squeezy **[TU]**

### 3.1 Produse

1. Store nou
2. Variants: Monthly **$5.99**, Yearly **$59.99** (2 Variant ID-uri)
3. Copiaza Store ID, checkout base `https://<slug>.lemonsqueezy.com/checkout`, cele 2 variant IDs

### 3.2 Env FE

In `.env.local` + GitHub secrets:

```
VITE_LEMONSQUEEZY_STORE_ID=...
VITE_LEMONSQUEEZY_CHECKOUT_URL=https://<slug>.lemonsqueezy.com/checkout
VITE_LEMONSQUEEZY_MONTHLY_VARIANT_ID=...
VITE_LEMONSQUEEZY_YEARLY_VARIANT_ID=...
```

**[REPO]** URL: `…/checkout/buy/<variant>?checkout[custom][user_id]=<id>` — fail-closed fara cele 4 vars.

### 3.3 Webhook

- URL: `https://moneo.bond/api/webhook/lemonsqueezy`
- Secret = acelasi ca `LEMON_SQUEEZY_WEBHOOK_SECRET`
- Evenimente: subscription_created/updated/cancelled/expired (+ payment_success ok)

Fara secret → 503. Semnatura gresita → 401.

### 3.4 API key

Settings → API → `wrangler secret put LEMON_SQUEEZY_API_KEY` (pentru portal).

### 3.5 Verificare

Pricing → Upgrade → Lemon → dupa plata: rand in `subscriptions`; Manage → portal HTTPS.

---

## PASUL 4 — GitHub secrets + deploy **[TU]**

Secrets Vite: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, cele 4 Lemon, optional `VITE_SENTRY_DSN`.

Deploy: Actions → **CI** → Run workflow pe `main` (approval `production`).

Local alternativ:

```powershell
npm run build
node scripts/deploy-assets.mjs
cd cloudflare\workers; npx wrangler deploy; cd ..\..
node scripts\check-dns.mjs
```

---

## PASUL 5 — DNS + HTTPS **[TU]**

1. Nameservers pe Cloudflare
2. Custom domain Worker `moneo.bond`
3. SSL Full (strict) + Always HTTPS
4. `node scripts\check-dns.mjs` → cf-ray + 200 pe `/`, manifest, sw.js

---

## PASUL 6 — Sentry **[TU]**

1. sentry.io → proiect React → copiaza DSN
2. `npm i @sentry/react`
3. `VITE_SENTRY_DSN=…` in `.env.local` + GitHub → rebuild

**[REPO]** Fara pachet/DSN = silent. Worker Sentry nu e in repo (optional ulterior).

---

## PASUL 7 — Securitate

**[REPO]** HSTS, HMAC webhook, checkout/portal https-only, CORS allowlist, rate limits, email/AI/billing fail-closed, `secret-scan` in CI.

**[TU]** Confirma: Bot Fight + WAF; niciun service_role in Git; webhook secret ne-expus; anon-only in FE.

---

## PASUL 8 — Mentenanta **[TU]**

| Ce | Cum |
|---|---|
| Health | Actions DNS + edge; `node scripts/check-dns.mjs` |
| Migratii | Staging first → prod gated; adauga `0007_…`, nu edita SQL aplicat |
| Backup | Supabase Database → Backups |
| UAT | `docs/UAT.md` — Focus, Auth+Sync, Pricing |
| Dependabot | `.github/dependabot.yml` |
| Email | Poate astepta (fail-closed in UI) |

---

## PASUL 9 — Smoke final (15 min) **[TU]**

1. https://moneo.bond HTTPS
2. Cont + Sync + Focus
3. Checkout Lemon + rand `subscriptions` + portal
4. Sentry on sau off intentionat
5. `npm run build:ci` verde

---

## Eu in repo vs tu in browser

### Eu am facut in repo

- Worker: webhook HMAC, portal, rate-limit, CORS, security headers
- FE Lemon fail-closed + preturi $5.99 / $59.99
- Stub Sentry + boot; migratii 0001–0006; CI/DNS/Dependabot/secret-scan
- `.env.example` actualizat (Worker secrets, email, Sentry, migratii)
- Acest ghid `OPS-LAUNCH.md` + pointer in `LAUNCH-9.md`

### Tu faci acum

1. Conturi Supabase x2, CF, Lemon, Sentry, GitHub env production
2. Auth URL + migratii staging
3. `wrangler secret put` (4+ chei)
4. Bot Fight Mode / WAF / HTTPS
5. Produse Lemon + webhook + API key
6. Lipire `VITE_*` + `npm i @sentry/react` + DSN
7. Deploy + check-dns + UAT + 1 checkout real

---

## Referinte

| Fisier | Rol |
|---|---|
| `cloudflare/workers/index.ts` | Rute API + webhook |
| `cloudflare/workers/portal.ts` | Customer portal |
| `cloudflare/workers/wrangler.toml` | Domain, R2, KV |
| `src/lib/billing/lemonSqueezy.ts` | Checkout + portal FE |
| `src/lib/sentry.ts` | Sentry fail-closed |
| `SECURITY.md` | Model amenintari |
| `docs/UAT.md` | QA |
| `DEPLOYMENT.md` | Release lung |

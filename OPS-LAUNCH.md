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
| Customer Portal | **[REPO]** `GET /api/billing/portal` (link semnat, cere `LEMON_SQUEEZY_API_KEY` pe Worker); fara cheie → portalul magazinului `/billing`, apoi `app.lemonsqueezy.com/my-orders` |
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
| Redirect URLs | `https://moneo.bond/**`, `http://localhost:3000/**` |

**Resetare parola** **[REPO]**: „Ai uitat parola?” la conectare trimite un email Supabase cu link spre `https://moneo.bond/reset-password`, unde utilizatorul alege parola noua. **[TU]** verifica:

1. Authentication → URL Configuration → Redirect URLs contine `https://moneo.bond/**` (sau explicit `https://moneo.bond/reset-password`). Fara asta, linkul din email duce pe Site URL si resetarea nu porneste.
2. Authentication → Emails → SMTP: serverul de email implicit Supabase trimite doar cateva emailuri pe ora — pentru clienti reali seteaza un SMTP propriu (ex. Resend, Postmark), altfel emailurile de resetare/confirmare se pot pierde.
3. Optional: Authentication → Emails → Templates → „Reset Password” — textul emailului (implicit in engleza).

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

**[TU]** Intoarcere dupa plata: la fiecare produs (Monthly + Yearly) → Confirmation modal → **Button link** = `https://moneo.bond/account?billing=success`. Linkurile de checkout Lemon nu accepta redirect ca parametru; `/account?billing=success` reincarca imediat abonamentul (tab-ul ramas deschis se reincarca oricum la focus).

### 3.3 Webhook

- URL: `https://moneo.bond/api/webhook/lemonsqueezy`
- Secret = acelasi ca `LEMON_SQUEEZY_WEBHOOK_SECRET`
- Evenimente: subscription_created/updated/cancelled/expired (+ payment_success ok)

Fara secret → 503. Semnatura gresita → 401.

### 3.4 API key

Settings → API → `wrangler secret put LEMON_SQUEEZY_API_KEY` (optional, dar recomandat).

**[REPO]** Ce face cheia cand e setata pe Worker:

- „Gestioneaza abonamentul” deschide direct portalul semnat al abonamentului (fara login cu email).
- La „Sterge contul”, Worker-ul **anuleaza intai abonamentul Lemon activ** (reinnoirea se opreste; accesul ramane pana la finalul perioadei platite), apoi sterge datele. Daca Lemon refuza anularea, stergerea se opreste (se poate reincerca).

**Fara cheie (starea actuala):** butonul deschide portalul magazinului `https://moneo.lemonsqueezy.com/billing` (cumparatorul primeste link pe email), iar confirmarea de stergere a contului avertizeaza utilizatorii cu abonament activ sa-l anuleze intai din portal. Stergerea contului **nu** anuleaza singura abonamentul.

```powershell
cd cloudflare\workers
npx wrangler secret put LEMON_SQUEEZY_API_KEY
```

### 3.5 Verificare

Pricing → Upgrade → Lemon → dupa plata: rand in `subscriptions`; Manage → portal HTTPS.

### 3.6 Plan anual + anulare **[REPO]**

- **Fara migratie noua.** Se folosesc coloanele existente `status`, `plan_id`, `current_period_end`.
- Planul (lunar/anual) se decide in Worker (`cloudflare/workers/subscriptionAccess.ts`): intai dupa ID-urile numerice Lemon din `wrangler.toml` `[vars]` (`LEMON_YEARLY_IDS`, `LEMON_MONTHLY_IDS` — variant + product, publice), apoi dupa numele produsului („Moneo Pro (Yearly)”). Produs nou in Lemon → adauga ID-urile acolo.
- Anulare: Lemon trimite `status: cancelled` + `ends_at`; Worker-ul scrie `current_period_end = ends_at`, iar Pro ramane activ pana la acea data (Cont: „Anulat — Pro activ pana la …”). `past_due` = Pro (Lemon reincearca ~2 saptamani); `unpaid` / `paused` / `expired` = Free.
- Randurile vechi (ex. anual salvat ca `pro-monthly`) se corecteaza la urmatorul webhook `subscription_*` dupa deploy. Mai rapid: Lemon → Settings → Webhooks → livrarea `subscription_created`/`subscription_updated` → Resend.

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
| Backup | Free: Actions **DB backup** (saptamanal, vezi 8.1). Pro: Supabase Database → Backups |
| Keepalive | Actions **Supabase keepalive** (zilnic, citire REST) — Free pune proiectul pe pauza dupa ~7 zile fara activitate |
| UAT | `docs/UAT.md` — Focus, Auth+Sync, Pricing |
| Dependabot | `.github/dependabot.yml` |
| Email | Poate astepta (fail-closed in UI) |

### 8.1 Backup DB (cat timp Supabase e pe Free)

Workflow `.github/workflows/db-backup.yml`: duminica 03:00 UTC face `pg_dump` (datele din `auth.users` + `auth.identities`, apoi schema + datele din `public`), il cripteaza cu gpg AES256 si il urca ca artifact (pastrat 30 de zile). Repo-ul e public, deci artifactul e mereu criptat. Fara secretele de mai jos jobul se sare (notice), nu pica.

**Secrets GitHub** (repo → Settings → Secrets and variables → Actions → New repository secret):

1. `SUPABASE_DB_URL` — Supabase → proiect `moneo-dev` → butonul **Connect** (sau Project Settings → Database) → **Connection string** → **Session pooler** (merge pe IPv4, cum sunt runner-ele GitHub). Arata ca `postgresql://postgres.yvkguiiqojwyosvkxzbt:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres` (hostul exact il copiezi din dashboard); inlocuiesti `[YOUR-PASSWORD]` cu parola bazei (daca ai uitat-o: Database → Settings → Reset database password — atunci actualizeaza si alte locuri care o folosesc). In secret pui doar linkul, fara `psql`, fara ghilimele si fara parantezele `[ ]`. Daca parola are `@ / ? # %` sau spatii, fie le codezi (`@` → `%40`, `/` → `%2F`, `?` → `%3F`, `#` → `%23`, `%` → `%25`), fie resetezi parola la una doar cu litere si cifre. Pasul **Validate SUPABASE_DB_URL** din workflow spune exact ce nu e in regula, fara sa afiseze valoarea.
2. `BACKUP_PASSPHRASE` — o parola lunga, aleatoare (ex. 32+ caractere din password manager). **Pastreaz-o in password manager**: fara ea backup-urile nu se pot decripta.

**Rulare manuala:** Actions → **DB backup** → Run workflow (pe `main`).

**Descarcare + restore** (Linux/macOS/WSL; Windows: Git Bash are `gpg`; `psql` din PostgreSQL 17):

```bash
# 1. Actions → rularea DB backup → Artifacts → descarci zip-ul si il dezarhivezi
# 2. Decriptare (cere BACKUP_PASSPHRASE):
gpg -d moneo-db-YYYYMMDD-HHMMSS.sql.gpg > moneo-db.sql
# 3. Restore intr-un proiect Supabase NOU si gol (Session pooler URL al lui):
psql "postgresql://postgres.<ref-nou>:<parola>@aws-0-<regiune>.pooler.supabase.com:5432/postgres" -f moneo-db.sql
# (sau direct: gpg -d moneo-db-....sql.gpg | psql "<URL>")
```

Eroarea `schema "public" already exists` la restore e normala. Dupa restore: actualizezi `SUPABASE_URL` / chei (worker + variabile `VITE_*`), rotesti `SUPABASE_SERVICE_ROLE_KEY`, verifici login → sync → abonament pentru un cont de test (vezi `SECURITY.md` → Backups & restore). Nu restaura peste proiectul existent: randurile din `auth` ar da conflicte de chei.

**Dupa upgrade la Supabase Pro** (backup-uri zilnice incluse, fara pauza la inactivitate) workflow-urile **DB backup** si **Supabase keepalive** devin redundante: le dezactivezi din Actions (… → Disable workflow) sau le stergi printr-un PR.

Nota: GitHub opreste singur workflow-urile programate intr-un repo public dupa 60 de zile fara niciun commit; daca se intampla, Actions → workflow → Enable.

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

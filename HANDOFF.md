# MONEO — Fișier de predare (handoff)

**Pentru:** orice agent care continuă lucrul (Cursor, Claude Code, OpenCode).
**Ultima actualizare:** 22 septembrie 2026 — vezi §0. Secțiunile §1–§6 de mai jos sunt istoricul din 18.09; unde contrazic §0, **§0 are dreptate**.

---

## 0. Actualizare 22.09.2026 — integrări externe + Mono adus peste `main`

### 0.1. Stare Git (important înainte de orice)

- **Sursa de adevăr este `origin/main`.** Totul e integrat acolo: PR #25 (Turnstile + Sentry + redirect www), PR #26 (Mono Focus peste main), PR #37 (fix teste E2E).
- Branch-ul `feat/mono-launch` este **complet inclus** în `main` (prin PR #26). Nu mai lucra pe el și **nu-l face merge din nou** — ar readuce ~700 de conflicte.
- Branch-ul local `main` vechi (cu commit-urile `86ccb0e…2b7ee8b`) a fost comprimat pe GitHub în commit-uri squash. **Nu face `git pull` pe un `main` local vechi** — creează un merge cu conflicte în 100+ fișiere. Aliniere sigură:
  ```
  git branch backup/main-vechi main
  git checkout -B main origin/main
  ```
- Flux de lucru: branch nou din `origin/main` → commit → PR → merge. `main` nu are protecție de branch, dar CI rulează pe fiecare PR.
- Pe Windows, dacă Git întreabă `Unlink of file ... failed. Should I try again? (y/n)`: răspunde `n` (e doar curățenie internă; un proces `git fsmonitor--daemon` ține fișierul deschis). Nu afectează codul.

### 0.2. Deploy (s-a schimbat!)

- **Deploy-ul e MANUAL.** Push/merge pe `main` rulează doar verificările. Publicare: GitHub → **Actions** → **CI** → **Run workflow** pe `main` → aprobare mediu `production` dacă e cerută.
- Jobul `deploy` rulează doar după `lint`, `typecheck-test-build` și `e2e` verzi; face build Vite, urcă `dist/` în R2 (`scripts/deploy-assets.mjs`), `wrangler deploy`, apoi `scripts/check-dns.mjs`.
- Check-ul roșu **„Workers Builds: moneo-focus”** pe PR-uri e un worker Cloudflare separat, vechi, legat de repo din dashboard. Nu ține de cod, nu blochează nimic. Se oprește din Cloudflare → Workers & Pages → moneo-focus → Settings → Build → Disconnect.

### 0.3. Servicii externe — ce e conectat

| Serviciu          | Stare                | Detalii                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Namecheap**     | ✅                   | `moneo.bond` folosește nameserverele Cloudflare (`diana`/`kipp.ns.cloudflare.com`). Nimic de schimbat la Namecheap.                                                                                                                                                                                                                                                                                    |
| **Cloudflare**    | ✅                   | Cont `26064c3c685ef04b1104cab44acb9b5e`. Worker `moneo` pe `moneo.bond` (custom domain) + `www.moneo.bond/*` (route; worker-ul face 301 spre apex — `canonicalRedirect()` în `cloudflare/workers/security.ts`). KV `KV_CACHE`, R2 `moneo-assets`. `SUPABASE_URL` e în `[vars]` din `wrangler.toml`.                                                                                                    |
| Worker secrets    | ✅                   | `SUPABASE_SERVICE_ROLE_KEY`, `LEMON_SQUEEZY_WEBHOOK_SECRET` (regenerat 22.09, identic cu cel din Lemon). Opționale nesetate: `LEMON_SQUEEZY_API_KEY` (pentru `/api/billing/portal`), `AI_API_KEY`. Se pun doar cu `wrangler secret put`, niciodată în cod sau `VITE_*`.                                                                                                                                |
| **Turnstile**     | ✅ cod / ⏳ Supabase | Widget `moneo-prod-auth`, site key public `0x4AAAAAAFAQF5fLTgr5bZ56` (domenii: moneo.bond, www.moneo.bond, localhost). Widget-ul apare la login/signup. **Rămâne de făcut de proprietar:** Supabase → Authentication → Attack Protection → Enable Captcha → Turnstile + secret key (secretul NU e în repo).                                                                                            |
| **Sentry**        | ✅                   | Org `andrei-teleaga` (regiunea DE), proiect `moneo`. Raportare ușoară, fără SDK: `src/lib/errorReporting.ts` (+ `AppErrorBoundary`). DSN-ul e public și e în `VITE_SENTRY_DSN`. Nu adăuga `@sentry/react` — varianta Mono cu SDK a fost scoasă intenționat.                                                                                                                                            |
| **Supabase**      | ✅ / ⏳ 0010         | Proiect `moneo-dev`, ref `yvkguiiqojwyosvkxzbt` (eu-west-1). Migrațiile 0001–0009 aplicate; **0010 `google_calendar_connections` NEAPLICATĂ** (stochează refresh token-uri Google — necesită acordul proprietarului). RLS activ pe toate tabelele. Advisor: activează „Leaked password protection”.                                                                                                    |
| **Lemon Squeezy** | ✅                   | Magazin `https://moneo.lemonsqueezy.com` (vechiul `monerobond` dădea 404). Checkout base `https://moneo.lemonsqueezy.com/checkout`; variante: lunar `af14a4fc-3755-4c5c-91d4-aca4bd553e32`, anual `256a59d8-c49a-4f1e-b3a5-fd4e718fa4eb`. Webhook → `https://moneo.bond/api/webhook/lemonsqueezy`, evenimente `subscription_*`. **Prețul afișat în checkout era $1 la 22.09 — de verificat în Lemon.** |

**Variabile de build (GitHub → Settings → Variables, nu Secrets):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_LEMONSQUEEZY_STORE_ID`, `VITE_LEMONSQUEEZY_CHECKOUT_URL`, `VITE_LEMONSQUEEZY_MONTHLY_VARIANT_ID`, `VITE_LEMONSQUEEZY_YEARLY_VARIANT_ID`, `VITE_TURNSTILE_SITE_KEY`, `VITE_SENTRY_DSN`. **Secrets GitHub:** `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`. Local: aceleași `VITE_*` în `.env.local` (ignorat de git).

### 0.4. Cum a fost integrat Mono peste `main` (PR #26)

Ambele branch-uri traduseseră aceleași componente independent, cu chei i18n diferite (ex. `main`: `goals.title`, Mono: `goal.title`). Reguli de rezolvare folosite — respectă-le la modificări viitoare:

- **UI, vizual, prețuri, texte → Mono.** Shell-ul e `src/mono/` (`MonoNav` rail/bară jos, `MonoFocus`, `MonoAzi`, `MonoOrar`, `MonoProiecte`, `MonoRapoarte`, `MonoCrestere`, `MonoMore`). `TopNav.tsx` și `TimerCard` din App nu mai există.
- **Funcții care existau doar în `main` → păstrate și legate în Mono:** legături între entități (`lib/entityLinks.ts`, `LinkedItems`) pe obiective/proiecte/abilități/OKR/jurnal; tab **Graph** (`GraphCard`; în rail pe desktop, în „More” pe mobil); **paleta de comenzi Ctrl+K** (`CommandPalette`, buton în rail, listă din `MONO_NAV_ITEMS` exportată din `MonoNav`); **Command Center** (sus în extra-urile ecranului Azi); filtre salvate (`SavedFiltersBar` în Proiecte); reflecție după sesiune (`PostSessionReflection`, comutator în Notificări); capsule de timp + celebrări; conflicte Google Calendar în Orar; rute `/login`, `/account` (`CabinetPage`), `/account/calendar-callback`; Gantt refăcut (`TimelineTab`); flash XP/level-up la abilități; rezumat narativ săptămânal + export portofoliu (Pro) în Rapoarte.
- **Infrastructură → `main`:** Turnstile, `errorReporting`, redirect www, variabile CI.
- **Traduceri:** dicționarele Mono + cheile existente doar în `main` adăugate la finalul fiecărui fișier din `src/lib/i18n/locales/` (blocul „Merged from main”). Chei noi: folosește convenția Mono (`goal.*`, `proj.*`, `task.*`, `rep.*`, `cal.*`, `mono.*`) și adaugă-le în **toate 8** limbile.
- `useAppPersistence` a devenit `usePersonalDataPersistence` (include și `links`, `savedFilters`).

### 0.5. Teste E2E (Playwright, `e2e/`)

Rescrise pentru Mono: timer (preseturi 5/25/45, Start → Pause → Resume, ceas `.atm-time`), navigare (tab-uri, Graph desktop/mobil, Ctrl+K — așteaptă `.atm-time` înainte de scurtătură), limita Free de 3 proiecte, pagini publice. Pe ecranul gol Proiecte butonul „+ New Project” apare de 2 ori → folosește `.first()`. Local: `npx playwright install chromium` apoi `npx playwright test` (serverul pornește pe portul 3000).

### 0.6. Ce rămâne de făcut (proprietarul)

1. Supabase: activare captcha Turnstile (vezi 0.3).
2. Decizie + aplicare migrația `0010_google_calendar_connections.sql`.
3. Lemon Squeezy: verificat prețul ($1?), activare magazin (ieșire din Test mode), test de plată în Test mode cu cardul `4242 4242 4242 4242` → verificat rândul în `public.subscriptions`.
4. Deploy manual (Actions → CI → Run workflow) după fiecare set de schimbări.
5. Opțional: deconectare worker `moneo-focus` din Cloudflare; „Leaked password protection” în Supabase.

### 0.7. Porți înainte de orice PR

`npx prettier --check "src/**/*.{ts,tsx,css}" "cloudflare/**/*.ts"` · `npm run lint` · `npx tsc --noEmit` · `npx vitest run` (944 teste la 22.09) · `npm run build` · `node scripts/perf-budget.mjs` · `npm run secret-scan`.

---

## 1. Ce este Moneo

Companion de focus + planificare, local-first (React 18 + TypeScript + Vite 6 + Tailwind 4 + Supabase + Cloudflare Workers). Funcționează fără cont; datele stau în `localStorage`, sync opțional via Supabase.

**Comenzi esențiale** (rulate din rădăcina repo-ului):

| Comandă                          | Rol                                                             |
| -------------------------------- | --------------------------------------------------------------- |
| `npm run dev`                    | server local → http://localhost:5173                            |
| `npm run build:ci`               | **POARTA obligatorie:** `tsc` + toate testele + build producție |
| `npm run lint`                   | **POARTA obligatorie:** eslint pe tot repo-ul                   |
| `npx prettier --write <fișiere>` | formatare înainte de commit                                     |

**Stare porți:** `build:ci` verde — 66 fișiere teste, **753 teste trecute**; `lint` verde.

> ⚠️ PowerShell 5.1: fără `&&`, fără `head/tail/grep`. Înlănțuire: `cmd1; if ($?) { cmd2 }`.

---

## 2. Arhitectură — două straturi vizuale coabitante

### 2.1. Stratul vechi (`src/components/`, clase `.card`, tokeni `--color-*`)

Ecranele construite în fazele 0–7. Încă în uz acolo unde migrarea Mono n-a ajuns la interior (vezi §4). **Nu șterge tokenii vechi** până nu migrează tot.

### 2.2. Stratul Mono (`src/mono/` — designul nou „V1 Mono · Pânză infinită")

- `tokens.css` — variabila paralele `--mono-*`, light default + variantă dark (`[data-theme='dark']`)
- `mono.css` — clasele primitivelor + shell + navigație
- Primitive: `MonoBtn/Chip/Tick/Progress/Card/Tag/Stat/Empty/Head/Toast` (+ teste `mono.test.ts`)
- Ecrane: `MonoNav` (taburi), `MonoMore` (hub), `MonoFocus`, `MonoAzi`, `MonoOrar`, `MonoProiecte`, `MonoRapoarte`, `monoDate.ts`
- Fonturi self-host (fără CDN!): `@fontsource/cal-sans`, `inter` (400–700), `jetbrains-mono` (400–600), importate în `main.tsx`, incluse în bundle (inclusiv subseturi chirilice)

**Navigație Mono (6 destinații):** Focus, Azi, Orar, Proiecte, Rapoarte + Mai mult (hub: Plan AI, Creștere, Hartă, Setări, cont, Ajutor/Confidențialitate/Termeni). Bottom tabs pe mobil, rail lateral pe desktop (≥1024px). Footerul vechi a fost eliminat.

**Decizii luate (nu le redeschide fără motiv):** light default + dark păstrat; fonturi self-host; toate 8 limbile la lansare; TOATE funcțiile vechi se păstrează, restilizate în limbaj Mono; tema default `light` în `lib/theme.ts`.

---

## 3. Ce s-a făcut (istoric complet)

### 3.1. Fazele 0–7 + monetizare (săptămânile 1–10)

Timer, proiecte/sarcini WBS, rapoarte + export CSV/PDF, insight-uri, Ivy Lee, broască, matrice Eisenhower, calendar, obiective/OKR, asistent, obiceiuri/jurnal/energie, sprinturi Agile/kanban/Gantt/cascadă, abilități + facturare, PWA, onboarding, setări aspect, paywall Lemon Squeezy (Free/Pro).

### 3.2. Faza 3–7 „Spark" (commit `2b7ee8b`)

Life Map (roată echilibru, tab Hartă), motion/faza 4, **i18n 8 limbi** (en/ro/ru/uk/de/it/fr/es — `en.ts` e sursa de adevăr; lipsa unei chei = eroare compilare), securitate 5A (`SECURITY.md`, headere/rate-limit/CSP, scan secrete), AI Planning Companion (local, 501 fără cheie LLM), insight-uri acționabile + QA.

### 3.3. Finalizare i18n (~1372 chei/locală, zero duplicate, test de paritate + placeholdere)

Toate cardurile + setări/notificări/pricing/onboarding/help/footer + notificări browser traduse și cablate.

### 3.4. Redesign Mono (NECOMIS — working tree)

- **MONO-1:** fonturi + tokeni + tema default light (+ fix test `theme.test.ts`)
- **MONO-2:** 10 primitive + 5 teste
- **MONO-3:** `MonoNav` + `MonoMore`, tab nou **Orar** (`CalendarCard` mutat din Azi), șters `TopNav.tsx`/footer/cautare `/`/pastila „today", chei `mono.nav.*`, 4 teste
- **MONO-4 Focus:** `MonoFocus` integral (card cerneală + ring, chips 5/25/45, intenție, selectoare Arie/Proiect/Sarcină, stats reale, Urmează cu tick, popup rezumat + feedback learner 4 atingeri, stări pauză) — `TimerCard` scos din App; chei `mono.focus.*` (20), 5 teste
- **MONO-4 Azi:** `MonoAzi` (ritualuri, progres + priorități din planul Ivy al zilei cu CRUD, formular adăugare cu limită 3/6, Program via `UpNext`); `IvyLeeCard` scos din App; chei `mono.azi.*` (9), 4 teste
- **MONO-4 Orar/Proiecte/Rapoarte:** coji Mono (`MonoOrar` cu interval săptămânal, `MonoProiecte` cu contor, `MonoRapoarte`) peste cardurile vechi; cheia `mono.proj.active`, 3 teste

---

## 4. Ce rămâne

### MONO-5 — restilizare interioară + secundare (în lucru)

Cardurile vechi încă nerestilizate (funcționale, aspect vechi): `CalendarCard`, `ProjectsCard`, `AgileCard`, `ReportsCard`, `UpNext`, `FrogCard`, `MatrixCard`, `LifeCard`. Ecrane secundare de adus în limbaj Mono: Plan AI, Obiective/OKR, Asistent, Hartă, Viață, Abilități, **Setări (inclusiv administrarea ariilor — CRUD scos din App, de reimplementat aici)**, Cont. Ordine sugerată: Setări → Plan AI/Asistent → restul.

### MONO-6 — final

Chei noi ×8 la fiecare pas (ancorare pe linii unice, NICIODATĂ `};` la final de bloc!), apoi `build:ci` + `lint`.

### Restanțe cunoscute (mici)

- Căutarea `/` și pastila „today" au picat la trecerea pe MonoNav (de reintrodus în formă Mono sau tăiat asumat)
- `nav.hint.today` menționează încă calendarul (mutat la Orar)
- Rezumatul de pauză (break) nu mai are popup (sesiunile înregistrate sunt doar focus) — asumat, notificarea browser rămâne
- `PrivacyPolicy` + `TermsOfService` rămân în EN (asumat pentru documente legale)

### Blocaje de lansare (cer acces extern, nu cod)

Secrete Supabase + `db push` migrații, DNS, deploy Cloudflare, Lemon Squeezy real + test cu bani adevărați, cheie LLM, GCal OAuth, mail real, QA manual browser. `MUSE-SPARK-ROADMAP.md` + `SECURITY.md` sunt sursele de adevăr.

---

## 5. Convenții obligatorii pentru continuator

1. **Schimbări mici, testabile.** După fiecare etapă: `build:ci` + `lint` + prettier pe fișierele atinse.
2. **i18n:** cheile noi intră în `en.ts` + TOATE cele 7 locale (altfel pică `tsc`). Doar chrome UI, niciodată conținut utilizator. Formatări via `t/tp/fmtDur/fmtClock/fmtDayKey/fmtNum`, date via `tag`.
3. **Stocare:** `storageAdapter` nu aruncă niciodată; chei fixate în `storageKeys.ts` + `storage.test.ts`; fără bump de versiune schema la chei aditive.
4. **Securitate:** fără secrete/service-role în frontend, fail-closed, `npm run secret-scan` la nevoie.
5. **Teste noi:** fișiere `*.test.ts` (NU `.tsx` — configul vitest include doar `.ts`), randare via `createElement` + `createRoot` + `act`, ca în `src/mono/*.test.ts`.
6. **Git:** commit doar la cerere; înainte de commit: `status` + `diff`; niciodată secrete în commit. La preluare: verifică `git status` (66 fișiere necomise!) și fă un commit de salvare.

## 6. Fișiere-cheie

`src/App.tsx` (compoziție + taburi) · `src/mono/` (tot designul nou) · `src/lib/i18n/locales/` (8 limbi) · `src/lib/{tasks,projects,ivyLee,timeBlocks,reports,insights,theme}.ts` (logica) · `src/hooks/useTimer.ts` · `MUSE-SPARK-ROADMAP.md` · `SECURITY.md`

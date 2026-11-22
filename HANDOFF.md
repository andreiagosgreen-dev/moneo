# MONEO — Fișier de predare (handoff)

**Pentru:** orice agent care continuă lucrul (Cursor, Claude Code, OpenCode).
**Ultima actualizare:** 22 noiembrie 2026 (stare PR-uri până la #199 + upgrade UX/Design/Perf pe `feat/upgrade-to-95`) — vezi §0. Secțiunile §1–§6 de mai jos sunt istoricul din 18.09; unde contrazic §0, **§0 are dreptate**.

---

## 0. Actualizare 22.11.2026 — Stare curentă (`main` la PR #199 + `feat/upgrade-to-95`)

### 0.0. Ce s-a livrat între PR #76 și PR #199 (pe `origin/main`)

- **Move / Fitness complet (#175–#179):** echipamente home-gym + 40+ exerciții, ghidaj audio/beeps/voice coach 3-2-1, pachete rapide de antrenament, obiective & rapoarte per exercițiu legate la Goals, generare AI de antrenamente pe Pro (`/api/ai/workout`).
- **Trial & Lifecycle Emails (#183–#187):** 7 zile Pro gratuit de la sign-up fără card, tur de 7 zile (`trialTour.ts`), email ziua 5 + reminders via Resend (`cloudflare/workers/emails.ts`, cron zilnic `0 8 * * *`), verificare Pro unificată pe server.
- **SEO & Legal (#174, #196, #199):** ghiduri statice în `en/ro/ru` cu `hreflang`, date structurate și sitemap; pagini legale (`/terms`, `/privacy`, `/refund`) prerendered fără JS (`src/components/legal/prerender.tsx`), în toate 8 limbile; `0` exporturi moarte (`#186`); `wrangler 4.147.0` + `react-router-dom 7.18.4`.
- **Migrații SQL:** `0001`–`0009` + `0011_user_records` + `0012_subscription_lemon_updated_at` + `0013_subscriptions_policy_initplan` (`0010_google_calendar_connections` rămâne condiționată de decizia proprietarului).
- **Worker bindings active (`cloudflare/workers/wrangler.toml`):** R2 (`moneo-assets`), KV (`KV_CACHE`), Workers AI (`AI`), Analytics Engine (`EVENTS` → `moneo_events`), cron (`0 8 * * *`).
- **Branch `feat/upgrade-to-95` (redesign complet Visual-First + Personal OS HUD + Google SEO + igienă):**
  - **Igienă & Securitate:** șterse 3 componente legacy moarte (1.420 LOC: `TimerCard.tsx`, `IvyLeeCard.tsx`, `UpNext.tsx`); `0` `dangerouslySetInnerHTML` (`MonoNav.tsx` → JSX `<MonoTabIcon>`); `0` `as any` / `: any` în producție (`syncEngine.ts`, `cloudflare/workers/index.ts`, `lemonWebhook.ts`).
  - **Performanță:** lazy-loading pentru cele 11 pachete de fonturi Pro (`src/lib/proFontLoader.ts` + test), eliminate 41 de importuri CSS eager din `src/AppRoot.tsx`.
  - **Redesign Visual-First (stil Apple / Opal / Linear / WHOOP):**
    - Atmosferă default `ritual` obsidian-pin cu contrast WCAG AAA/AA (`42/42` atmosfere verzi), dot-matrix + auroră animată pe GPU, carduri glassmorphic unificate (inclusiv `.card` legacy).
    - **Focus Cockpit (`MonoFocus.tsx`):** cronograf 60-ticks cu arc gradat luminos + punct orbital, doar 3 pastile rapide (`5m · 25m · 45m`) + `Custom` la cerere, un singur CTA luminos rotunjit (`Start`), 3 mini-inele SVG pentru statistici, zero texte/ghiduri redundante.
    - **Today Bento Cockpit (`MonoAzi.tsx`):** 2 coloane pe desktop, benzi laterale de prioritate, buton `▶ Focus` 1-click pe fiecare task, fără ziduri de text.
    - **Zero secțiuni „More / Advanced planning” urâte:** toate cele 3 `<Disclosure>` din `App.tsx` înlocuite cu bare curate Segmented Switcher integrate natural (`Projects · Board · Matrix · Command Center` în Proiecte; `Goals · Assistant · OKRs · Skills` în Plan; `Frog · Life` discret în Today).
    - **J.A.R.V.I.S. Personal OS HUD (`MonoHudCore.tsx` + test):** 3 inele concentrice luminoase (Mind · Execution · Body) cu scor OS 0–100 + curbă de evoluție pe 14 zile cu delta săptămânal `+X%` în `Growth`, plus scanner biometric luminos pe harta musculară (`MonoBodyMap`) din `Move`.
  - **Landing Page & Google SEO:** demo **LIVE interactiv** (`LiveHeroDemo.tsx`: Focus / Today / Habits / HUD 3-inele) chiar în Hero pe `/welcome`, schemă animată SVG `01 → 02 → 03`, JSON-LD extins (`SoftwareApplication`, `FAQPage`, `Organization`, `WebSite`, `HowTo`), `robots` rich previews și `VITE_GOOGLE_SITE_VERIFICATION` în `vite.config.js` + `ci.yml`.

### 0.1. Stare Git (important înainte de orice)

- **Sursa de adevăr este `origin/main`.** Totul e integrat acolo: PR #25 (Turnstile + Sentry + redirect www), PR #26 (Mono Focus peste main), PR #37 (fix teste E2E), PR #38 (`AGENTS.md` + acest §0).
- **La 28.09 sunt unite în `main` și publicate pe moneo.bond** (ultimul deploy manual: commit-ul lui #76): #67 bifele din Azi completează task-ul legat, #68 checklist Lemon test → live, #69 pagini Terms/Privacy/Refund, #70 XP, niveluri și ranguri, #71 billing anual + Pro până la `ends_at` la anulare, #72 ștergere cont / CSP / og:image, #73 export/import date JSON (free), #74 copy fără jargon „local-only”, #75 sync complet Pro, #76 landing la prima vizită (`/`, `/welcome`).
- **În lucru:** fix pentru overflow orizontal pe mobil.
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

| Serviciu          | Stare                | Detalii                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Namecheap**     | ✅                   | `moneo.bond` folosește nameserverele Cloudflare (`diana`/`kipp.ns.cloudflare.com`). Nimic de schimbat la Namecheap.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Cloudflare**    | ✅                   | Cont `26064c3c685ef04b1104cab44acb9b5e`. Worker `moneo` pe `moneo.bond` (custom domain) + `www.moneo.bond/*` (route; worker-ul face 301 spre apex — `canonicalRedirect()` în `cloudflare/workers/security.ts`). KV `KV_CACHE`, R2 `moneo-assets`. `SUPABASE_URL` e în `[vars]` din `wrangler.toml`.                                                                                                                                                                                                                                                                                                                                                                                             |
| Worker secrets    | ✅                   | `SUPABASE_SERVICE_ROLE_KEY`, `LEMON_SQUEEZY_WEBHOOK_SECRET` (regenerat 22.09, identic cu cel din Lemon). Opționale nesetate: `LEMON_SQUEEZY_API_KEY` (portal semnat `/api/billing/portal` + anularea abonamentului la ștergerea contului; fără ea, portalul cade pe `moneo.lemonsqueezy.com/billing`), `AI_API_KEY`. Se pun doar cu `wrangler secret put`, niciodată în cod sau `VITE_*`.                                                                                                                                                                                                                                                                                                       |
| **Turnstile**     | ✅ cod / ⏳ Supabase | Widget `moneo-prod-auth`, site key public `0x4AAAAAAFAQF5fLTgr5bZ56` (domenii: moneo.bond, www.moneo.bond, localhost). Widget-ul apare la login/signup. **Rămâne de făcut de proprietar:** Supabase → Authentication → Attack Protection → Enable Captcha → Turnstile + secret key (secretul NU e în repo).                                                                                                                                                                                                                                                                                                                                                                                     |
| **Sentry**        | ✅                   | Org `andrei-teleaga` (regiunea DE), proiect `moneo`. Raportare ușoară, fără SDK: `src/lib/errorReporting.ts` (+ `AppErrorBoundary`). DSN-ul e public și e în `VITE_SENTRY_DSN`. Nu adăuga `@sentry/react` — varianta Mono cu SDK a fost scoasă intenționat.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Supabase**      | ✅ / ⏳ 0010         | Proiect `moneo-dev`, ref `yvkguiiqojwyosvkxzbt` (eu-west-1). Migrațiile 0001–0009 + **0011 `user_records`** (sync complet Pro) aplicate — 0011 aplicată la 28.09 prin MCP `apply_migration`, rândul din istoric redenumit la versiunea `0011`. **0010 `google_calendar_connections` NEAPLICATĂ intenționat** (stochează refresh token-uri Google — necesită acordul proprietarului); ștergerea contului tolerează lipsa tabelului (#72). **Nu rula workflow-ul „Supabase migrations”** (`supabase db push`) — ar aplica și 0010; până la decizia pe 0010, migrațiile se aplică una câte una din SQL Editor / MCP. RLS activ pe toate tabelele. Advisor: activează „Leaked password protection”. |
| **Lemon Squeezy** | ✅                   | Magazin `https://moneo.lemonsqueezy.com` (vechiul `monerobond` dădea 404). Checkout base `https://moneo.lemonsqueezy.com/checkout`; variante: lunar `af14a4fc-3755-4c5c-91d4-aca4bd553e32`, anual `256a59d8-c49a-4f1e-b3a5-fd4e718fa4eb`. Webhook → `https://moneo.bond/api/webhook/lemonsqueezy`, evenimente `subscription_*`. **Prețul afișat în checkout era $1 la 22.09 — de verificat în Lemon.**                                                                                                                                                                                                                                                                                          |

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
2. Decizie + aplicare migrația `0010_google_calendar_connections.sql` — doar ea, din Supabase → SQL Editor (conținutul fișierului) / MCP, nu prin workflow-ul „Supabase migrations”. (0011 e deja aplicată.)
3. Lemon Squeezy: verificat prețul ($1?), activare magazin (ieșire din Test mode), test de plată în Test mode cu cardul `4242 4242 4242 4242` → verificat rândul în `public.subscriptions`.
4. Deploy manual (Actions → CI → Run workflow) după fiecare set de schimbări.
5. Opțional: deconectare worker `moneo-focus` din Cloudflare; „Leaked password protection” în Supabase.

### 0.7. Porți înainte de orice PR

`npx prettier --check "src/**/*.{ts,tsx,css}" "cloudflare/**/*.ts"` · `npm run lint` · `npx tsc --noEmit` · `npx vitest run` (944 teste la 22.09) · `npm run build` · `node scripts/perf-budget.mjs` · `npm run secret-scan`.

### 0.8. Decizii produs din sesiunea Cursor (22.09) — nu le redeschide fără motiv

- **Atmosfere = doar culori.** Există ~20 de atmosfere (`src/mono/atmosphere.ts`, default `ritual`). **Același layout Focus pe toate**; nu reintroduce ramuri JSX pe layout (hartie/ritual/țărm etc.). Tokenii `--mono-*` pe `.atm-root[data-atmosphere]` + font cascade pe `html` / Tailwind `@theme`.
- **Prețuri Pro în UI:** `$5.99` / lună, `$59.99` / an (`pricingConfig.ts`). Copy Pro trebuie să fie onest (Free cu cont: sync sesiuni + arii + setări; Pro: toate datele salvate în cont; atmosferele Focus rămân free; fonturi Pro în Setări).
- **Fonturi Pro:** picker în Setări, gated pe `auth.isPro` (`data-font` → `--mono-font-*`). Free = stack Implicit. Nu confunda cu atmosferele.
- **Brand:** `public/brand/` (logo 1200, mark, header Lemon 1600×300, cover Monthly/Yearly), favicon în `index.html` + PWA. Magazin Lemon: `https://moneo.lemonsqueezy.com`.
- **Dev server:** Vite pe **port 3000** (`vite.config.js`), nu 5173. După schimbări în `.env.local` → **restart complet** Vite (HMR nu reîncarcă env).
- **Sync:** nu e bug de engine dacă lipsește env valid; UI arată `outcome.error`. **Orice cont** (cu sync pornit): `focus_sessions` + `focus_areas` + `user_settings` (`syncEngine.ts`). **Pro** (în plus): toate datele de planificare în `user_records` (migrația **0011**), inclusiv jurnalul de antrenamente (colecția `workouts`, formă `object-list`: câte o înregistrare per antrenament, inclusiv cardio manual cu `km` + `rest` pentru obicei/loc/orar/rutine proprii/programul personal) — lista de colecții e în `src/lib/sync/proCollections.ts` și trebuie să fie identică cu `PRO_SYNC_COLLECTION_NAMES` din `cloudflare/workers/proSync.ts` (test). Scrierile trec doar prin Worker (`POST /api/sync/records`, Pro verificat pe server); citirea e RLS owner-only. Conflict = ultima modificare câștigă per înregistrare; ștergeri = tombstone. Pro expirat → datele rămân pe dispozitiv, copia din cont nu se mai actualizează. Status în Setări și Cont (`MonoCloudSync`). Nu sincronizăm: chat asistent, chei AI, temă/limbă/atmosferă.
- **Ghid ops:** `OPS-LAUNCH.md` (pas cu pas) + `LAUNCH-9.md` (checklist scurt).
- **PR-uri Mono vechi:** `feat/mono-launch` / #24 nu se mai unesc pe main — conținutul e în #26.
- **Landing (`src/landing/`):** apare pe `/` doar la prima vizită (fără date Moneo locale, fără sesiune, fără `moneo:landing-seen`) și oricând pe `/welcome`. Decizia e în `src/lib/landing.ts` (funcție pură, testată) și se ia în `main.tsx` înainte de a încărca aplicația (`AppRoot` e lazy). Link-urile directe (`/pricing`, `/account…`, `/?action=…`) nu sunt interceptate niciodată. În E2E, `skipOnboarding` sare și peste landing. Capturile din landing se regenerează cu `node scripts/landing-shots.mjs` (dev server pornit).

### 0.9. Prima replică recomandată în chat Cursor

> Citește `AGENTS.md` și `HANDOFF.md` §0 înainte să începi.

---

## 1. Ce este Moneo

Companion de focus + planificare, local-first (React 18 + TypeScript + Vite 6 + Tailwind 4 + Supabase + Cloudflare Workers). Funcționează fără cont; datele stau în `localStorage`, sync opțional via Supabase.

**Comenzi esențiale** (rulate din rădăcina repo-ului):

| Comandă                          | Rol                                                             |
| -------------------------------- | --------------------------------------------------------------- |
| `npm run dev`                    | server local → http://localhost:3000                            |
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

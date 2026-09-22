# MONEO — Fișier de predare (handoff)

**Pentru:** alt cont al firmei, care continuă lucrul cu OpenCode.
**Data:** 18 septembrie 2026. **Commit de bază:** `2b7ee8b` (tot ce urmează e NEM comis — 66 fișiere modificate/noi în working tree).

---

## 1. Ce este Moneo

Companion de focus + planificare, local-first (React 18 + TypeScript + Vite 6 + Tailwind 4 + Supabase + Cloudflare Workers). Funcționează fără cont; datele stau în `localStorage`, sync opțional via Supabase.

**Comenzi esențiale** (rulate din rădăcina repo-ului):
| Comandă | Rol |
|---|---|
| `npm run dev` | server local → http://localhost:5173 |
| `npm run build:ci` | **POARTA obligatorie:** `tsc` + toate testele + build producție |
| `npm run lint` | **POARTA obligatorie:** eslint pe tot repo-ul |
| `npx prettier --write <fișiere>` | formatare înainte de commit |

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

# Moneo — Plan de integrare Faza 13-33 (viziune "produs premium")

> **Cum se folosește acest document:** e scris să fie auto-suficient pentru a
> începe o conversație nouă. Dă-l ca prim mesaj/context unei sesiuni noi
> Claude Code, în același working directory
> (`C:\Users\Andrei\Desktop\programm\moneo\.claude\worktrees\ghidaj-responsabilitati-9b7aca`
> sau checkout-ul curent al repo-ului `moneo`), și poți spune direct
> "continuă cu Faza 13" sau orice fază de mai jos.

## Context — de unde vine acest plan

Sesiunea anterioară a acoperit, în ordine: hardening de securitate (RLS/RPC),
Sentry, curățenie de cod, integrare Google Calendar (doar citire), redesign
Gantt/Timeline, o trecere de polish vizual (contrast/densitate/animație), și
o cercetare amplă de 16 produse concurente (Toggl, Todoist, Motion, TickTick,
Trello, Asana, ClickUp, Jira, Clockify, Monday.com, Linear, Superhuman,
Obsidian, Habitica, Duolingo, Notion) — vezi
`ANALIZA-CONCURENTA-10-PRODUSE.md` și `COMPETITOR-RESEARCH-2026-09.md` în
rădăcina repo-ului pentru detalii complete (ce face fiecare, puncte forte,
rating pe părți, ce se împrumută și de unde).

**Obiectivul declarat de utilizator:** un produs premium care schimbă tot —
design/utilități/proprietăți/ușurință toate la nivel maxim, clar și simplu de
folosit, care te ajută să te dezvolți și să înveți repede, să faci mult și
rapid. Cu o precizare importantă de principiu, discutată explicit: efectul de
"nu pot fără ea zi de zi" trebuie obținut prin **valoare reală și momente de
wow autentice**, NU prin mecanici de manipulare/vinovăție (streak-guilt,
pedepse tip Habitica) — asta ar contrazice direct poziționarea "calm,
low-stimulus" deja validată de cercetarea de competitori din Faza 8.

După cercetarea de competitori, sesiunea a mai trecut prin trei pași
concreți înainte de acest document:

1. **Rating pe părți** pentru fiecare din cele 10+6 produse (design, font,
   utilități, ușurință, preț-valoare, performanță, recenzii, final) — vezi
   `ANALIZA-CONCURENTA-10-PRODUSE.md`, secțiunea "Rating pe părți", cu surse
   reale (G2/Capterra) citate pentru fiecare scor.
2. **5 concepte vizuale de design** explorate direct într-un canvas Artifact
   (Linear Speed / Playful Momentum / Deep Focus / Bold Command Center /
   Moneo Refined), urmate de un al 6-lea concept — **"The Combinator"** —
   care fuzionează câte un element vizual din fiecare din cele 10 site-uri
   inițiale peste baza vizuală "Moneo Refined" (care e deja identică cu
   token-urile reale din `index.css`, deci nu un re-skin). Utilizatorul a
   ales explicit Concept 6 ca direcție finală.
3. **Faza 30-31 (mai jos) — deja implementate și verificate** în această
   sesiune: fix-ul de navigare "More ▾" și componenta "Command Center" pe
   ecranul Focus, ca traducere concretă și cu date reale a machetei
   Concept 6 (nu un re-skin — surfacing de date deja calculate în Moneo).

**Numerotare:** Faza 1-12 sunt deja documentate/executate (vezi
`C:\Users\Andrei\.claude\plans\sharded-brewing-grove.md` dacă hitoricul de
plan mai există în acea sesiune — altfel, git log pe branch-urile
`feat/*`/`chore/*`/`fix/*` din acest repo arată munca deja făcută). **Faza
30-31 sunt de asemenea deja implementate** (vezi secțiunea dedicată mai
jos). Acest document continuă, pentru munca nefăcută încă, de la **Faza
13**.

## Principii care ghidează toate fazele de mai jos

1. **Local-first rămâne sacru** — orice funcție nouă trebuie să funcționeze
   fără cont, fără cloud, cu sync opțional (pattern-ul deja stabilit în tot
   codul existent: `localStorage` întâi, Supabase opțional).
2. **Recompensă, nu pedeapsă** — orice mecanică de progres/gamification
   (XP, streak, celebrări) arată doar partea pozitivă; fără pierdere de
   "viață"/puncte, fără vinovăție pentru absență.
3. **Rar și real bate frecvent și gol** — sărbătoririle/momentele speciale
   trebuie să rămână rare ca să-și păstreze sensul (critica explicită adusă
   gamification-ului tocit prin repetiție la Duolingo/Habitica).
4. **Fiecare funcție nouă respectă regula de 100ms** (Superhuman/Linear) —
   dacă o acțiune nouă simte lent, nu se lansează așa.
5. **Nicio funcție nouă nu forțează configurare** înainte de valoare — orice
   adaugă Moneo trebuie să funcționeze cu setări implicite sensibile.

---

## Faza 30-31 — "The Combinator" (✅ DONE, implementat în această sesiune)

Traducerea concretă a Concept 6 în cod real, cu date reale — nu machetă.

- **Faza 30 — fix navigare "More ▾":** `src/components/TopNav.tsx` — cele
  8 tab-uri sunt acum 4 primare mereu vizibile (Focus/Today/Plan/Assistant)
  - un buton "More ▾" fix, în afara zonei de scroll, cu popover pentru
    Growth/Map/Projects/Reports. Rezolvă bug-ul confirmat: pe ecrane înguste,
    tab-urile din coadă erau accesibile doar printr-un gest de scroll
    nedescoperibil (`.no-scrollbar` + `.tabs-scroll`, doar fade cosmetic).
    Testat manual la 760px lățime — toate cele 8 secțiuni rămân accesibile
    fără niciun scroll.
- **Faza 31 — Command Center:** `src/components/CommandCenter.tsx` (nou),
  montat pe ecranul Focus (`App.tsx`) pentru orice cont care nu mai e
  brand-nou (`!showGettingStarted`). Widget-uri cu date 100% reale, zero
  placeholder: mini-board pe statusuri (Trello), breadcrumb Goal→Proiect
  (Asana, via noile `goalForProject`/`goalAncestry` din `src/lib/goals.ts`),
  chip sprint activ (Jira, `activeSprint`), inel de progres proiect
  (Monday, `projectCompletion`), bare de timp săptămânal (Clockify,
  `buildReport`), task curent cu cadran Eisenhower (TickTick,
  `effectiveQuadrant`) și streak habit (`habitStreak`).
- **Explicit lăsate pentru alte faze**, ca să nu se dubleze munca: parsarea
  NLP la quick-add (Todoist) și sugestia AI de slot (Motion) țin de
  **Faza 15** de mai jos; chip-ul `⌘K` ține de **Faza 13**; comutatorul de
  vederi (ClickUp) e opțional, neadăugat.
- Verificat: `npx tsc --noEmit`, `npx vitest run` (732 teste), `npm run
build:ci`, plus verificare manuală în browser (proiect + task reale →
  widget-urile arată exact acele date).

---

## Valul 1 — Câștiguri rapide (viteză + wow imediat, efort mic)

Toate independente între ele, se pot face în orice ordine sau în paralel.

### Faza 13 — Paletă de comenzi globală (`Cmd/Ctrl+K`) — ✅ DONE

- Implementat: `src/components/CommandPalette.tsx` (nou), deschidere
  globală via `Cmd/Ctrl+K` de oriunde (listener în `App.tsx`) + chip vizual
  `⌘K` lângă search-ul din `TopNav.tsx` (exact ce arăta machetă Concept
  5/6). Acțiuni azi: start/pause timer, navigare instant la oricare din
  cele 8 tab-uri, salt direct la un proiect/task/goal găsit prin căutare
  fuzzy (peste 2 caractere).
- Navigare tastatură completă (Săgeți/Enter/Escape), reutilizează pattern-ul
  de `hits`/`highlight` deja existent în search-ul din `TopNav.tsx`, fără
  să-l înlocuiască (rămân ambele, palette e mai puternic, search-ul rămâne
  pentru căutare rapidă inline).
- **Lăsat pentru altă fază, ca să nu se dubleze munca**: creare task direct
  din palette (are nevoie de UI de creare cu proiect/prioritate — mai mare
  decât scope-ul unei simple navigări) și shortcut-urile `N`/`G+literă`/`C`
  la nivel de aplicație — merg natural cu Faza 15 (AI assistant) sau ca
  fază separată mică, dacă se dorește explicit.
- **Sursă:** Linear, Superhuman.

### Faza 18 — Filtre salvate / Smart Views — ✅ DONE

- Implementat: `src/lib/savedFilters.ts` (`SavedFilter` — nume + criterii
  status/priority/projectId/dueWithinDays, toate opționale, peste câmpuri
  deja existente pe `Task`, zero date noi; `matchesFilter`/`applyFilter`
  pure, `createSavedFilter`/`removeSavedFilter`, plafon `MAX_SAVED_FILTERS
= 20`), cheie nouă `moneo:saved-filters`. UI nou
  `src/components/SavedFiltersBar.tsx` — chip-uri pentru vederile salvate,
  formular compact de creare, listă plată de task-uri (cross-proiect)
  potrivite, click → selectează proiectul. Montat în `ProjectsCard.tsx`
  sub câmpul de căutare existent; state (`savedFilters`) trece prin
  `App.tsx`/`useAppPersistence.ts` exact ca `links` (Faza 14).
- 4 teste noi în `savedFilters.test.ts`, suita completă (777 teste),
  `tsc`, lint, `build:ci` — toate verzi.
- **Sursă:** Todoist.

### Faza 26 — Time capsule

- Notă atașată unui `Goal`, cu livrare programată la `targetDate`-ul lui.
- Livrare: notificare in-app (mecanism deja existent,
  `notificationPrefs.ts`/`showNotification`) la data țintă.
- **Idee proprie.**

### Faza 27 — Sărbătoriri rare, semnificative — ✅ DONE

- Implementat: `src/lib/celebrations.ts` (`pendingCelebrations()` pur —
  primul Goal finalizat vreodată (global, cel mai vechi după `updatedAt`),
  fiecare Goal nivel `milestone` finalizat (câte unul per goal), praguri
  `FOCUS_DAYS_THRESHOLDS = [100, 250, 500, 1000]` zile distincte de focus;
  jurnal "deja arătat" persistat `moneo:celebrations-shown`, cheie nouă în
  `storageKeys.ts`), hook `src/hooks/useCelebrations.ts` (coadă, o
  sărbătorire arătată o dată, restul așteaptă), component nou
  `src/components/CelebrationOverlay.tsx` (un singur modal reutilizabil,
  invocat rar — reutilizează `.dialog-pop`/`.backdrop-fade` deja existente,
  fără animație nouă de CSS).
- 6 teste noi în `celebrations.test.ts`, suita completă (773 teste),
  `tsc`, lint, `build:ci` — toate verzi.
- **Sursă:** idee proprie — pereche naturală cu Faza 16 (nefăcută încă).

### Faza 28 — Acțiuni în masă pe task-uri — ✅ DONE

- Implementat: 4 helpere noi pure în `src/lib/tasks.ts`
  (`bulkSetStatus`/`bulkSetPriority`/`bulkSetDueAt`/`bulkMoveToProject`),
  fiecare aplicând funcția single-id existentă într-un `reduce` peste o
  listă de id-uri — zero logică nouă de business, doar compunere. UI:
  checkbox de selecție nou în `TaskRow.tsx` (opțional — `selectedIds`/
  `onToggleSelect` neobligatorii, threadat recursiv la subtask-uri), bară
  de acțiuni în masă în `ProjectRow.tsx` (apare doar când ≥1 task e
  selectat) — prioritate, reprogramare, mutare în alt proiect.
- 4 teste noi în `tasks.test.ts`, suita completă (781 teste), `tsc`,
  lint, `build:ci` — toate verzi.
- **Sursă:** idee proprie.

---

## Valul 2 — AI Assistant (cel mai mare gol documentat)

### Faza 15 — AI: asistent mult mai dezvoltat — 🟡 primul increment DONE

- **(1) Intenții de modificare — ✅ DONE**: `src/lib/assistant.ts` —
  `respondTo()` recunoaște acum `complete X` / `mark X as done`,
  `delete X` / `remove X`, `reschedule X to <dată>`, `make X p0` /
  `set X urgent` — rezolvare fuzzy a titlului peste task-urile deschise,
  cu mesaj de dezambiguizare când sunt mai multe potriviri și mesaj clar
  când nu găsește niciuna. Conectat în `AssistantCard.tsx` la helperele
  deja existente și testate (`completeTask`, `removeTask`, `setDueAt`,
  `setTaskPriority` din `tasks.ts`).
- **(2) Context de conversație — ✅ DONE (minimal)**: `respondTo()` acceptă
  un `focusTaskId` opțional; orice acțiune de modificare reușită devine
  noul "task în focus", deci "fă-l p0" sau "șterge-l" fără să repeți
  titlul funcționează pentru turul următor (`AssistantCard.tsx` ține
  `focusTaskId` în state, nepersistat).
- **(3) Parsare de date mai bogată — ✅ DONE**: `parseDuePhrase()` (nou,
  exportat) înțelege acum și nume de zile ("friday", "next monday"),
  "the 15th" (ziua curentă a lunii, sau luna viitoare dacă a trecut) și
  "next month" — pe lângă azi/mâine/săptămâna viitoare/în N zile, care
  rămân neschimbate (regresie verificată cu testele existente).
- **(4) Conștientizare Command Center — ✅ DONE**: `AssistantContext`
  primește acum opțional `sprints`/`selectedProjectId`; răspunsul la
  "plan my day" menționează sprintul activ al proiectului selectat
  (`activeSprint`, aceeași funcție ca în Command Center), iar răspunsul
  la "what should I work on?" menționează goal-ul legat de proiectul
  task-ului recomandat (`goalForProject`, funcția nouă din Faza 31) —
  fără date noi, doar reutilizare a ceea ce Command Center-ul afișează
  deja.
- **Rămas pentru un pas următor** (nu în acest increment): (5) traducerea
  răspunsurilor asistentului (azi engleză hard-codată în `assistant.ts`,
  netratată de Faza 33 — Faza 33 acoperă doar JSX din componente, nu
  textul generat dinamic aici) — e o lucrare mai mare (fiecare propoziție
  trebuie rescrisă cu `t()`/`tp()` și interpolare, iar `respondTo` e o
  funcție pură din `lib/` care ar trebui să primească `t`/`tp` ca
  parametru nou), de tratat separat, nu combinat cu restul Faza 15.
- Verificat: `npx tsc --noEmit`, 12 teste noi (`assistant.test.ts`,
  `parseDuePhrase` + cele 4 intenții de modificare + ambiguitate + task
  inexistent + follow-up cu "it" + cele 3 de conștientizare context),
  suita completă (744 teste) + `build:ci`, toate verzi. **Neverificat
  manual în UI** — AssistantCard e gated Pro pentru input liber de text,
  iar sesiunea de dev nu are un cont Pro la îndemână; corectitudinea se
  bazează pe acoperirea de teste de mai sus, nu pe o verificare vizuală.
- **Sursă:** gol propriu documentat + inspirație de la ClickUp
  Brain2/Asana AI Teammates (context larg, proactivitate).

### Faza 22 — Rezumat săptămânal narativ de la AI — ✅ DONE

- Implementat pe modelul deja existent `okrReview()` din `okrs.ts` (text
  generat rule-based peste chei i18n, determinist, fără apel LLM) — nu un
  motor AI nou, ci același pattern reutilizat pentru un domeniu nou:
  `src/lib/weeklyReview.ts` cu `weekMinutesByProject()` (cea mai lucrată
  săptămâna asta), `stagnatingTasks()` (task-uri deschise întârziate SAU
  neatinse de 14+ zile, cele mai vechi primele) și `weeklyNarrative()` care
  compune 3-4 linii: cel mai bun lucru, ce stagnează, o întrebare de
  decizie ("reprogramezi sau renunți?") pentru cea mai stagnantă intrare.
  Afișat în `ReportsCard.tsx`, în secțiunea "More detail" (Faza 12).
- 5 teste noi în `weeklyReview.test.ts`, suita completă (790 teste),
  `tsc`, lint, `build:ci` — toate verzi.
- **Sursă:** idee proprie.

### Faza 24 — Prompt de reflecție automat, post-sesiune — ✅ DONE

- Implementat: `src/lib/journal.ts` (`SESSION_REFLECTION_PROMPTS` +
  `promptForSession()` rotativ pe minut, `appendSessionReflection()` care
  adaugă un bullet la textul zilei, acumulând peste mai multe sesiuni),
  card compact non-blocant `src/components/PostSessionReflection.tsx`
  (colț jos-dreapta, Skip/Save, nu un modal full-screen — păstrează
  principiul "calm, low-stimulus"), declanșat din `App.tsx` la fiecare
  `onSession` (doar sesiuni de focus finalizate natural, nu pauze/skip-uri).
  Comutator nou `notificationPrefs.sessionReflection` (implicit `true`) în
  `NotificationsSettings.tsx`, pentru cine vrea să-l dezactiveze.
- 4 teste noi în `journal.test.ts` (rotație determinist, acumulare bullet,
  no-op pe text gol), suita completă (767 teste), `tsc`, lint, `build:ci`
  — toate verzi.
- **Sursă:** idee proprie.

---

## Valul 3 — Graf de cunoștințe + Skills (diferențiator major, efort mare)

### Faza 14 — Linkuri bidirecționale + vedere-graf — ✅ DONE

- Implementat: `src/lib/entityLinks.ts` (edge list centralizată,
  `createLink`/`removeLink`/`linksFor`/`cleanupLinksFor`, 9 teste),
  widget-ul reutilizabil `src/components/LinkedItems.tsx` montat în
  `GoalsCard.tsx`/`ProjectRow.tsx`/`SkillsCard.tsx`/`JournalTab.tsx`, și
  tab nou "Graf" (`src/components/GraphCard.tsx`) cu layout circular SVG
  (reutilizând tehnica `polar()` din `LifeMapCard.tsx`) — noduri colorate
  pe tip, muchii, click pentru evidențiere. Curățare automată a
  legăturilor la ștergerea unui Goal/Project/Skill (gaura de "id-uri
  fantomă" găsită prin explorare, acum rezolvată la o singură sursă).
- **Corecție găsită în timpul implementării**: `src/lib/links.ts` era deja
  ocupat de un modul de securitate (sanitizare URL-uri externe, Faza 5A)
  — modulul nou a fost redenumit `entityLinks.ts`.
- **Rămas de verificat manual de utilizator**: cascada de curățare la
  ștergere nu a putut fi testată vizual în browser-ul automat (dialogul
  nativ `confirm()` nu poate fi condus din test automat) — corectitudinea
  e acoperită de test unitar + inspecție de cod, dar merită un click real.
- **Sursă:** Obsidian.

### Faza 23 — Arbore de skill-uri vizual — ✅ DONE

- Implementat exact cum sugera planul: peste `skills.ts` existent
  (`level`/`category`, neatinse semantic) + infrastructura de linkuri din
  Faza 14 (linkuri skill↔skill, deja posibile prin `LinkedItems` montat
  pe fiecare skill din Faza 14/19 — nicio dată nouă necesară). Component
  nou `src/components/SkillTreeCard.tsx`: layout SVG "tech tree" —
  categoriile devin coloane/ramuri, nivelul (1-5) devine treaptă verticală
  (1 jos, 5 sus), noduri colorate/opace proporțional cu nivelul, linkurile
  skill-skill se desenează ca "căi de deblocare" între noduri, click pe
  nod deschide detaliile skill-ului (reutilizează `openId` deja existent
  în `SkillsCard.tsx`). Montat într-un `<Disclosure>` nou în
  `SkillsCard.tsx`, deasupra listei de skill-uri.
- Verificat manual în browser (seed direct în `localStorage` cu 2 skill-uri
  frontend legate + 1 backend): coloanele "FRONTEND"/"BACKEND", gridul de
  trepte 1-5 și nodurile colorate au apărut corect, fără erori în consolă.
- Zero teste noi (component prezentațional peste funcții deja testate în
  `skills.test.ts`/`entityLinks.test.ts`, la fel ca `GraphCard.tsx`),
  `tsc`, lint, `build:ci` — toate verzi, suita rămâne la 797 teste.
- **Sursă:** idee proprie + Obsidian.

### Faza 17 — XP pe skill + recompensă variabilă — ✅ DONE

- Reutilizat mecanismul deja existent de "sesiune alocată unui skill":
  `logLearningMinutes()` din `src/lib/skills.ts`, singurul punct din cod
  unde utilizatorul creditează minute unui skill (butonul "+25m" din
  `SkillsCard.tsx`) — nu s-a atins fluxul Timer-ului/sesiunilor live, care
  rămâne scoped pe proiect ca și până acum. `Skill.xp: number` nou
  (aditiv, implicit 0), `rollSessionXp()` (8-15 XP, `Math.random`,
  `XP_MIN_PER_SESSION`/`XP_MAX_PER_SESSION` exportate), XP acordat automat
  la fiecare apel `logLearningMinutes` — **niciodată nu scade**, nicio
  mecanică punitivă (fără streak-loss, fără penalizare la nivel scăzut).
  Nivelul auto-evaluat (1-5) existent NU e atins — XP e un scor motivațional
  separat, nu redefinește semantica `level`/`targetLevel`. UI: XP afișat
  lângă minutele logate, cu același puls one-shot `.pop` din Faza 16 la
  fiecare câștig.
- 2 teste noi în `skills.test.ts` (range XP, XP crescător monoton),
  suita completă (792 teste), `tsc`, lint, `build:ci` — toate verzi.
- **Sursă:** Habitica + Duolingo, explicit fără partea toxică.

---

## Valul 4 — Conexiuni structurale + design wow

### Faza 19 — Legătura OKR↔Goals — ✅ DONE

- Implementat prin extinderea infrastructurii de graf din Faza 14, nu prin
  un nou sistem de linkuri paralel: `LinkEntityType` din
  `src/lib/entityLinks.ts` a primit un al 5-lea tip, `'objective'`, alături
  de `goal`/`project`/`skill`/`journal` — aceeași edge list, aceeași
  funcție de curățare la ștergere. `OkrCard.tsx` primește acum
  `links`/`onLinksChange`/`goals`/`projects`/`skills`, montează widget-ul
  `LinkedItems` pe fiecare `ObjectiveNode` (deci un Objective se poate lega
  liber de Goals, Projects, Skills sau o intrare de jurnal) și curăță
  legăturile la ștergerea unui obiectiv (`cleanupLinksFor(links,
'objective', id)`). `GraphCard.tsx` (tab-ul "Graf") arată acum și nodurile
  de tip Objective (culoare nouă, roz) în vederea unificată.
  Threading de prop nou (`objectives`) prin `LinkedItems.tsx`,
  `GoalsCard.tsx`/`GoalNode`, `SkillsCard.tsx`, `ProjectsCard.tsx`/
  `ProjectRow.tsx`, `LifeCard.tsx`/`JournalTab.tsx` — peste tot unde se
  montează deja `LinkedItems`.
- 1 test nou în `entityLinks.test.ts` (linkuri, rezolvare, curățare pentru
  tipul `objective`), suita completă (782 teste), `tsc`, lint, `build:ci`
  — toate verzi.
- **Sursă:** Asana Work Graph.

### Faza 16 — Design wow: micro-interacțiuni cu sens — ✅ DONE

- Reutilizat exact clasa CSS `.pop`/`@keyframes popRing` deja existentă
  (folosită azi doar de `TimerCard.tsx` la finalul unei sesiuni) — nu s-a
  adăugat animație nouă, ca să rămână coerent cu principiul "calm,
  low-stimulus" de la Faza 12 (fără loop-uri, un singur puls, o singură
  dată, exact la momentul evenimentului). Idiom identic:
  `key={flashCounter}` pe elementul care pulsează + counter incrementat
  DOAR la eveniment (nu la fiecare render), ca task-urile deja finalizate
  la încărcarea paginii să nu pulseze fals.
  - `TaskRow.tsx`: checkbox-ul pulsează o singură dată exact la
    finalizarea unui task (nu la fiecare re-render al unui task deja
    finalizat).
  - `SkillsCard.tsx`: eticheta de nivel pulsează o singură dată când
    utilizatorul crește manual nivelul unui skill (stare per-skill,
    `Record<skillId, counter>`), nu și la scădere sau la alte modificări.
- Milestone-uri de task (`task.milestone`) folosesc deja același checkbox
  — niciun tratament separat necesar.
- Zero teste noi (schimbare pur prezentațională, fără logică pură nouă);
  `tsc`, lint, `build:ci` — toate verzi, suita rămâne la 790 teste.
- Pereche naturală cu Faza 27 (sărbătoriri, deja făcută).

### Faza 20 — Doc simplu per proiect — ✅ DONE

- Implementat: `Project.doc?: string` nou (`src/lib/projects.ts`, plafon
  `MAX_PROJECT_DOC_LENGTH = 4000`), parsare defensivă în `loadProjects()`,
  `ProjectUpdates.doc` + handling în `updateProject()`. UI: textarea nou
  în `ProjectRow.tsx` (secțiunea extinsă, salvare pe `onBlur`).
- **Bug pre-existent găsit în timpul implementării, NEATINS aici**:
  `saveEdit()` din `ProjectRow.tsx` apelează
  `updateProject([project], project.id, {...})` — un array cu UN SINGUR
  proiect, nu `allProjects` — iar `onProjectsChange` (= `commitProjects`
  din `ProjectsCard.tsx`) tratează ce primește ca lista COMPLETĂ de
  proiecte. Editarea unui proiect din formularul inline pare să șteargă
  toate celelalte proiecte din storage + state. Cod nou din această fază
  (salvarea doc-ului) folosește corect `allProjects`. Bug-ul a fost
  semnalat separat (task de fundal), nu a fost combinat cu Faza 20 ca să
  nu-i lărgească scopul.
- Test nou în `projects.test.ts` (set/remove/blank pentru `doc`), suita
  completă (778 teste), `tsc`, lint, `build:ci` — toate verzi.
- **Sursă:** Notion/ClickUp Docs, redus la esențial.

---

## Valul 5 — Investiții mai mari, de luat în calcul separat

### Faza 25 — Focus buddy minimal — 🟡 cod DONE, pas manual rămas

- Implementat exact cum sugera planul, cu modelul de RLS strict de la
  `google_calendar_connections` (Faza 10): migrare nouă
  `supabase/migrations/0009_focus_buddy.sql` — tabel `focus_buddy_pairs`
  (user_a/user_b/invite_code/status), **zero policy-uri RLS** (nici măcar
  owner-select) — doar `service_role`, doar din Worker, poate atinge
  tabelul. Reutilizat `focus_sessions` (deja existent din schema de bază)
  pentru a calcula minutele de azi ale buddy-ului, fără tabel nou pentru
  asta.
  - Worker nou `cloudflare/workers/focusBuddy.ts` (mirror exact al
    pattern-ului din `account.ts`: identitate doar din JWT-ul propriu,
    niciodată din body): `/api/buddy/invite` (cod de 8 caractere,
    Pro-gated server-side), `/api/buddy/join` (revendică un cod pending,
    respinge auto-join), `/api/buddy/unpair`, `/api/buddy/status`
    (întoarce DOAR `{paired, todayMinutes}` — niciodată id/email/istoric
    al buddy-ului). Rutat + rate-limitat în `index.ts`; curățare la
    ștergerea contului adăugată în `account.ts` (filtru `or=` special,
    pentru că tabelul nu are o singură coloană `user_id`).
  - Client nou `src/lib/cloud/focusBuddyClient.ts` (fetch simplu către
    Worker, fail-open la "unpaired" pe orice eroare) + UI nou
    `src/components/account/FocusBuddy.tsx`, montat Pro-gated în
    `CabinetPage.tsx` lângă `SyncPanel`.
  - 13 teste noi (`focusBuddy.test.ts` pentru Worker — 8 teste, folosind
    exact pattern-ul `stubFetch` din `accountDeletion.test.ts`;
    `focusBuddyClient.test.ts` pentru client — 5 teste, fail-open
    verificat explicit), plus actualizarea testului de ștergere cont
    existent. Suita completă (810 teste), `tsc`, lint, `build:ci` —
    toate verzi.
- **Limită onestă, identică cu Faza 10**: migrarea `0009_focus_buddy.sql`
  NU a fost aplicată pe proiectul Supabase live (necesită autorizare
  explicită pentru o acțiune ireversibilă pe infrastructură partajată —
  nu s-a cerut și nu s-a dat în această sesiune) — funcția e complet
  scrisă și testată, dar nefuncțională în producție până la (1) aplicarea
  migrării `0009` pe Supabase live și (2) redeployul Worker-ului cu noul
  fișier `focusBuddy.ts`. Recomand aceiași pași ca la Faza 10: aplică
  migrarea, apoi `wrangler deploy`.
- **Simplificare cunoscută**: constrângerile unice pe `user_a`/`user_b`
  garantează "cel mult un pairing per coloană", dar nu împiedică teoretic
  un user să fie `user_a` într-un rând și `user_b` în altul simultan —
  invarianta "un singur buddy odată" e impusă la nivel de aplicație
  (Worker-ul verifică ambele coloane înainte de invite/join), nu prin
  constrângere SQL. Acceptabil pentru scope-ul "minimal" al fazei.
- **Sursă:** idee proprie — variantă redusă de accountability social.

### Faza 29 — Portofoliu exportabil — ✅ DONE

- Implementat exact cum sugera planul: `src/lib/portfolio.ts` reutilizează
  idiomul `escHtml`/HTML autonom/`printReportHTML` deja existent din
  `export.ts` (Print → Save as PDF din browser, fără librărie nouă de
  PDF). `buildPortfolioData()` selectează: proiecte 100% finalizate
  (`projectCompletion`), goal-uri complet atinse (`goalProgress >= 100`,
  ne-arhivate), skill-uri la nivel 4+ ("puternice") — toate din date deja
  existente, zero câmpuri noi pe entități. `buildPortfolioHTML()` produce
  o pagină de sine stătătoare, de partajat. Buton nou "Export Portfolio"
  în `ReportsCard.tsx`, lângă exporturile CSV/PDF deja existente
  (`goals`/`skills` adăugate ca prop-uri noi la `ReportsCard`).
- 5 teste noi în `portfolio.test.ts` (filtrare completare 100%, goal-uri
  atinse, skill-uri puternice, escaping XSS pe nume netrusted), suita
  completă (797 teste), `tsc`, lint, `build:ci` — toate verzi.
- **Sursă:** idee proprie.

### Faza 21 — Automatizări simple ("when X then Y") — ✅ DONE

- Ținut STRICT minimal, exact cum cerea planul: **o singură regulă
  built-in**, nu un rule-builder configurabil de utilizator (ar fi
  alunecat spre complexitatea ClickUp/Jira, explicit respinsă). Regula:
  "când toate subtask-urile unui task sunt finalizate, task-ul părinte se
  finalizează automat — și se redeschide automat dacă un subtask e
  redeschis." Implementat ca funcție pură nouă
  `syncParentCompletion(tasks, changedTaskId)` în `src/lib/tasks.ts`, care
  urcă pe lanțul de părinți (un părinte finalizat poate finaliza bunicul
  ș.a.m.d.), idempotentă, fără efecte pentru task-uri fără subtask-uri sau
  root. Cablată la cele 2 puncte reale unde se schimbă statusul unui task:
  `TaskRow.tsx` (checkbox-ul din listă) și `BoardTab.tsx` (drag-and-drop
  Kanban) — nu s-a atins `completeTask`/`updateTaskStatus` (funcții de
  bază, folosite de mult mai mulți apelanți) ca să nu schimbe implicit
  comportamentul lor pentru cod care nu se așteaptă la cascada asta.
- 3 teste noi în `tasks.test.ts` (auto-completare, auto-redeschidere,
  no-op pentru root/task inexistent), suita completă (785 teste), `tsc`,
  lint, `build:ci` — toate verzi.
- **Sursă:** Trello Butler.

---

## Faza 32 — Securitate, anti-bot, mentenanță (paralelă, nu blochează restul)

Discutată explicit ca gol real, nu presupunere — verificat direct în cod:
azi există rate-limiting per-IP pe Worker (`createRateLimiter`, folosit la
webhook/account/AI), dar **zero CAPTCHA/Turnstile** la signup sau login, și
**zero observability** (Sentry/health checks — deja semnalat lipsă în
`ROADMAP.md`). Faza 13-31 nu ating deloc aceste trei zone; sunt tratate
separat aici ca să nu se amestece cu munca de "produs premium".

### 32a. Turnstile pe signup/login — 🟡 partea de cod DONE, rămâne pasul tău

- **Implementat, altfel decât era planificat inițial (mai simplu, mai
  puțin cod nou)**: nu prin Worker propriu — Supabase Auth are suport
  nativ pentru Turnstile (Dashboard → Authentication → Settings → Bot and
  Abuse Protection), verificat server-side automat de Supabase însuși.
  Am adăugat: `src/lib/turnstile.ts` (citește `VITE_TURNSTILE_SITE_KEY`,
  never throws, testat), `src/components/account/TurnstileWidget.tsx`
  (încarcă scriptul Cloudflare o singură dată, randează widget-ul doar
  dacă site key e configurat — altfel randează `null`, autentificarea
  rămâne complet funcțională, fail-open ca tot restul codului local-first
  din acest fișier), și l-am montat în `AuthForm.tsx` (folosit deja de
  `/login` și de modalul rapid). `authController.ts`/`authProvider.tsx`
  acceptă acum un al treilea parametru opțional `captchaToken` la
  `signIn`/`signUp`, trimis către Supabase prin `options.captchaToken`.
  CSP-ul din `cloudflare/workers/security.ts` a fost extins cu
  `challenges.cloudflare.com` pe `script-src`/`connect-src`/`frame-src`
  (altfel propriul CSP strict blochează widget-ul).
- **Bug critic găsit și reparat pe drum, în același fișier**:
  `authProvider.tsx` lega clientul Supabase greșit — trimitea obiectul
  `SupabaseClient` întreg către `AuthClientLike`, în loc de `.auth`
  (singurul loc unde există `signInWithPassword`/`signUp`/`getSession`/
  `onAuthStateChange`). Verificat direct în tipurile `@supabase/supabase-js`
  — nu presupunere. Efect real: **când Supabase e configurat, orice
  autentificare (email, Google, restaurare sesiune) ar fi eșuat silențios
  și ar fi degradat la "anonymous"**, prins de `try/catch`-urile
  defensive din `authController.ts`. Netestat până acum — nu există
  `authProvider.test.tsx`, doar `authController.test.ts` care testează
  logica împotriva unui mock deja corect tipat, deci bug-ul de wiring nu
  putea fi prins de suita existentă. Fix: o linie, `.auth` adăugat.
- **Testat**: `src/lib/turnstile.test.ts` (3 teste), 3 teste noi în
  `authController.test.ts` care confirmă că `captchaToken` ajunge corect
  în `options` la `signInWithPassword`/`signUp` — indirect confirmă și
  fix-ul de wiring (testele foloseau deja `AuthClientLike` corect
  structurat). Verificat manual în browser: fără `VITE_TURNSTILE_SITE_KEY`
  setat, formularul de login nu încarcă niciun script extern și butonul
  "Sign in" rămâne activ — zero regresie când Turnstile nu e configurat.
- **Pas manual rămas al tău**: (1) creezi un site Turnstile în dashboard-ul
  Cloudflare, copiezi site key-ul public în `VITE_TURNSTILE_SITE_KEY`
  (vezi `.env.example`); (2) în Supabase Dashboard → Authentication →
  Settings → Bot and Abuse Protection, activezi Turnstile și pui secret
  key-ul acolo (Supabase face verificarea server-side, zero cod
  suplimentar de la noi). **Recomand și o verificare directă a fix-ului
  de autentificare** pe proiectul Supabase live, cât timp ești acolo —
  un sign-in real, cu Supabase configurat, ca să confirmi că merge (nu
  am putut testa asta local, fără credențiale Supabase reale în sesiune).

### 32b. Audit de securitate țintit

- `npm audit` + revizuire Dependabot (deja menționat parțial în
  `SECURITY.md` — de dus până la capăt, nu doar "npm audit, secret-scan"
  generic).
- CSP/security headers pe răspunsurile Worker — verificat ce există azi
  (`buildSecurityHeaders`) față de ce lipsește (ROADMAP.md le listează
  explicit ca "missing": CSP, worker rate limiting mai larg, secrets-in-
  bundle review).
- Recomand acesta ca **primul pas concret**, pentru că nu are nicio
  dependență externă (Turnstile/Sentry au nevoie de cont+chei) — pot
  începe direct cu ce e deja în repo.

### 32c. Observability minimă (Sentry + health checks) — 🟡 partea de cod DONE, rămâne pasul tău

- **`/api/health`** — implementat direct în `cloudflare/workers/index.ts`
  (rută nouă, același model ca `/api/account/delete`/`/api/ai/plan`):
  răspunde public, neautentificat, doar cu prezență/absență
  (`{ ok: true, env: { supabase, lemonSqueezy, ai } }`) — niciodată nu
  scurge valorile secretelor. Logica extrasă într-o funcție pură
  `buildHealthBody()`, testată (3 teste noi).
- **Sentry — doar erori, implementat altfel decât era planificat inițial**:
  nu SDK-ul oficial `@sentry/browser` (ar adăuga ~40kb+ unei aplicații
  care azi n-are nicio dependență de acest fel — tot codul e "hand-rolled"
  SVG/integrări proprii). În schimb: `src/lib/errorReporting.ts`, un
  reporter minim care trimite direct, prin `fetch()`, către endpoint-ul
  documentat "store" al Sentry — parsează DSN-ul, construiește un payload
  minim (mesaj + tip + stack, fără session replay/analytics/performance
  tracing), niciodată nu aruncă. Zero listener-e instalate când
  `VITE_SENTRY_DSN` lipsește. Montat o singură dată în `src/main.tsx`
  (`initErrorReporting()`), prinde erori JS neprinse + promisiuni
  respinse neprinse (`window.onerror`/`unhandledrejection`).
- **CSP extins** în `cloudflare/workers/security.ts` cu
  `https://*.sentry.io` pe `connect-src` (altfel fetch-ul e blocat de
  CSP-ul strict al aplicației).
- **Bug de infrastructură de testare găsit și reparat pe drum**: în
  `cloudflare/workers/` existau fișiere `.js`/`.d.ts` compilate, vechi,
  locale (nu urmărite de git — `.gitignore` le exclude deja corect), care
  umbreau sursele `.ts` la rezolvarea modulelor în teste. Efect real:
  testul `worker-security.test.ts` verifica de fapt CSP-ul **vechi**,
  compilat, nu modificările mele din Faza 32a/32c — a trecut din
  întâmplare, nu pentru că verifica ce trebuia. Șterse (fișiere locale,
  regenerabile, zero pierdere) — acum toate testele verifică sursa reală.
- **Testat**: `src/lib/errorReporting.test.ts` (7 teste: parsare DSN,
  payload, trunchiere mesaj lung), `src/lib/cloud/worker-health.test.ts`
  (3 teste). **Neverificat live** — n-am putut testa `/api/health` sau
  livrarea reală către Sentry fără a rula Worker-ul separat (`wrangler
dev`) sau fără un DSN real în sesiune; corectitudinea se bazează pe
  urmarea exactă a API-ului documentat Sentry + pe pattern-ul deja
  funcțional al celorlalte rute din `index.ts`.
- **Pas manual rămas al tău**: (1) cont Sentry, proiect nou, copiezi DSN-ul
  în `VITE_SENTRY_DSN` (vezi `.env.example`); (2) opțional, testează
  `curl https://moneo.bond/api/health` după deploy pentru health check.

---

## Faza 33 — Retrofit i18n complet (limba se schimbă peste tot, nu doar în nav) — ✅ DONE

**Reconfirmat explicit de utilizator**: la schimbarea limbii din Settings,
tot ce se vede trebuie să treacă în limba aleasă. Verificat direct în cod
(nu presupunere): grepând toate componentele pentru `useI18n`, gaura reală
erau exact 8 subcomponente niciodată retrofit-ate —
`src/components/agile/{BoardTab,SprintsTab,TimelineTab,WaterfallTab}.tsx`
și `src/components/life/{BalanceTab,EnergyTab,HabitsTab,JournalTab}.tsx` +
`src/components/projects/TaskRow.tsx` — restul componentelor de top-level
erau deja fie retrofit-ate (Faza 8), fie legitim excluse (`PrivacyPolicy`/
`TermsOfService`/`HelpPage`, text legal static în afara `LocaleProvider`,
by design), fie fără text propriu (`Disclosure`, `BrandMark`).

**✅ Gata** (verificat cu `tsc`, `i18n.test.ts` paritate, browser manual
cu limba schimbată în română — vezi tab-ul Viață din "Mai mult azi"):

- `life/EnergyTab.tsx`, `life/JournalTab.tsx`, `life/HabitsTab.tsx`,
  `life/BalanceTab.tsx` — toate 4 din sub-cardul "Viață".
- `agile/TimelineTab.tsx` — versiunea actuală (pre-rewrite Faza 11);
  cheile noi `agile.timeline.*` sunt pregătite să fie reutilizate direct
  când Faza 11 rescrie componenta.
- **Bug prins din drum, nu doar text**: în 2 din aceste fișiere
  (`TimelineTab.tsx`, `HabitsTab.tsx`) variabila de buclă `.map((t) => ...)`
  se numea `t`, exact ca funcția de traducere `const { t } = useI18n()` —
  shadowing care ar fi rupt orice apel `t(...)` din interiorul buclei.
  Redenumit (`row`, `tpl`) înainte de a introduce `t()` acolo.
- **Text explicit LĂSAT netradus, cu precedent din Faza 8/15**: propoziții
  generate de funcții pure din `lib/` (ex. `energyAdvice`/`breakAdvice` din
  `energy.ts`, `journal prompts`/`weeklySummary` din `journal.ts`,
  `balanceReport.advice`/`burnoutGauge.reasons` din `lifeAreas.ts`, numele
  din `HABIT_TEMPLATES`) — sunt "conținut generat", nu chrome de UI; a le
  traduce ar însemna să treci `t`/`tp` prin funcții pure din `lib/`, exact
  genul de lucrare mai mare deja amânată separat pentru `assistant.ts` la
  Faza 15 punctul (5). Nu le-am amestecat aici.

- **De asemenea gata**: `agile/BoardTab.tsx`, `agile/WaterfallTab.tsx`,
  `agile/SprintsTab.tsx`, `projects/TaskRow.tsx` (523 linii — cel mai mare
  fișier din tot Moneo) — toate cele 8 fișiere identificate inițial (zero
  `useI18n`) sunt acum complet traduse în toate cele 8 limbi.
- **Gaură suplimentară găsită în timpul verificării manuale, tratată tot
  aici**: `projects/ProjectRow.tsx` (439 linii) — deși importa deja
  `useI18n` (parte din cele "26 de componente" ale Faza 8), avea încă ~30
  stringuri hard-codate netraduse (badge-ul "Active", butoanele Edit/
  Duplicate/Archive/Delete, stat-urile Time/Sessions/Tasks done/Billable,
  heading-ul "Tasks", placeholder-ele de task/tag/rată orară etc.) — un
  fișier poate importa `useI18n` și tot să nu fie complet retrofit-at;
  găsit exact prin testarea manuală cerută de utilizator (creare proiect +
  schimbare limbă), nu prin grep-ul inițial (care căuta doar fișiere cu
  zero `useI18n`).
- **Bug de shadowing prins de 3 ori în total** în tot Faza 33 (nu doar în
  `TimelineTab.tsx`/`HabitsTab.tsx` menționate mai sus): și în
  `BoardTab.tsx` și `SprintsTab.tsx`, bucle `.map((t) => ...)` foloseau
  `t` ca variabilă pentru task, exact numele funcției de traducere —
  redenumite (`card`, `member`, `candidate`) înainte de a adăuga `t()`
  acolo.
- Verificare manuală explicită cerută de utilizator: schimbă limba din
  Settings în română și confirmă vizual — făcută pentru tab-ul Viață
  (Obiceiuri/Echilibru/Jurnal/Energie) ȘI pentru Proiecte (creare proiect
  nou, extindere card, toate butoanele/stat-urile/placeholder-ele), cu
  captură de ecran confirmată pentru fiecare.

---

## Explicit respinse / amânate pe termen lung

- **Custom fields generice** (ClickUp) — risc de complexitate, contrazice
  simplitatea Moneo.
- **Ligi/leaderboard social global** (Duolingo) — infrastructură socială
  mare, roadmap lung, nu acum.
- **Auto-tracking pasiv de activitate** (Clockify) — tensiune cu
  local-first/privacy.
- **Auto-scheduling AI** (Motion) — deja respins conștient în Faza 10
  (calendar Google e doar-citire, exact ca să evite acest risc).
- **Orice mecanică punitivă** (pierdere de viață/puncte pentru absență) —
  contrazice poziționarea "calm" validată de cercetare.

---

## Recomandare de ordine pentru sesiunea următoare

**Faza 30-31 sunt deja gata** (vezi mai sus). Următoarele, în ordine:

1. **Faza 32b** (audit de securitate țintit) — ✅ DONE (vezi mai sus).
2. **Faza 13** (paletă de comenzi) — ✅ DONE (vezi mai sus).
3. **Faza 32a** (Turnstile) — 🟡 partea de cod DONE; rămâne doar pasul tău
   manual (cont Cloudflare Turnstile + activare în Supabase Dashboard).
4. **Faza 15** (AI Assistant) — cel mai mare gol real, documentat
   independent; completează și quick-add NLP + sugestia AI de slot lăsate
   neconectate în Command Center.
5. **Faza 33** (retrofit i18n complet) — ✅ DONE (vezi mai sus).
6. **Faza 14** (linkuri + graf) — ✅ DONE (vezi mai sus).
7. **Faza 32c** (Sentry + health checks) — 🟡 partea de cod DONE; rămâne
   doar contul Sentry + DSN de la tine.
8. Restul valurilor, în ordinea de mai sus, fiecare ca plan separat.

**Pentru sesiunea nouă:** spune direct "continuă cu Faza 13" (sau orice
fază dorești) — acest document conține tot contextul necesar ca să nu fie
nevoie de re-explicare.

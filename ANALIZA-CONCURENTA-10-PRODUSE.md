# Analiză 10 produse — Toggl, Todoist, Motion, TickTick, Trello, Asana, ClickUp, Jira, Clockify, Monday.com

> Scop: bază de plecare pentru redesign și restructurare Moneo. Pentru fiecare produs:
> ce face, puncte forte, ce utilități/probleme rezolvă, și cum e construit (logica arhitecturală).
> Cercetare web (septembrie 2026) + cunoștințe consolidate despre aceste produse.
>
> Ratingurile pe părți (secțiunea de la final) combină scoruri reale G2/Capterra
> (verificate web, septembrie 2026) pentru coloana "Recenzii" cu evaluare informată
> pentru Design/Font/Utilități/Ușurință/Preț/Performanță — acestea din urmă sunt
> judecăți calitative motivate în text, nu cifre dintr-o sursă externă.

---

## 1. Toggl Track (toggl.com)

**Ce face:** Aplicație de time-tracking pură — cronometrezi cât timp petreci pe activități, proiecte, clienți. Nu e task manager, nu e PM tool; face UN lucru: măsoară timpul cu maximă fricțiune minimă.

**Puncte forte:**

- Cel mai rapid "start/stop" din categorie — un click, fără formulare.
- Funcționează offline și sincronizează ulterior.
- Rapoarte curate, exportabile, pe proiect/client/etichetă — gândite pentru facturare.
- Multi-platformă consistentă (desktop, mobil, web, extensii browser).
- Filosofie explicită "privacy-first" — nu face screenshot-uri sau supraveghere, spre deosebire de tool-urile corporate de monitorizare.

**Utilități / probleme rezolvă:**

- Freelanceri și agenții care trebuie să demonstreze clienților unde s-a dus timpul (facturare pe oră).
- Cine vrea date reale despre unde își pierde timpul, fără să adopte un sistem greoi de management de proiect.

**Cum e construit (logica):**

- Model de date minimalist: `Time Entry` (start, stop/durată, proiect, task opțional, tag-uri, client, billable flag) → totul agregă din acest singur obiect.
- Nu există ierarhie de proiect complexă — proiectele sunt containere plate, opțional cu task-uri simple în interior.
- Arhitectura e "capture-first": orice mod de a crea un time entry (timer live, manual, Pomodoro, calendar drag) converge la același obiect canonic, apoi rapoartele sunt query-uri agregate peste acea listă de entries.
- Ideea centrală: separă complet _urmărirea timpului_ de _planificare_ — nu încearcă să-ți spună ce să faci, doar cât ai făcut.

---

## 2. Todoist (todoist.com)

**Ce face:** Manager de task-uri personal/echipe mici, construit explicit pe metodologia GTD (Getting Things Done).

**Puncte forte:**

- Capture extrem de rapid (quick-add cu parsare de limbaj natural: "cumpără lapte mâine 9am #acasă p1").
- Filtre puternice printr-un limbaj de query propriu (ex: `overdue & #Muncă & p1`) — practic vederi custom nelimitate.
- Recurență flexibilă, remindere, integrare calendar.
- Karma (scor de productivitate) — gamification ușoară, fără să fie centrul experienței.
- 80+ integrări, ecosistem matur.

**Utilități / probleme rezolvă:**

- "Am prea multe lucruri în cap" → capture rapid, fără fricțiune, oriunde.
- Organizare ierarhică simplă (proiecte → secțiuni → task-uri) fără complexitatea unui PM tool.
- Echipe foarte mici care vor coordonare ușoară fără licențe scumpe de enterprise.

**Cum e construit (logica):**

- Arhitectura mapează literal cele 5 pași GTD: **Capture** (quick-add) → **Clarify/Organize** (proiecte, etichete, priorități) → **Reflect** (filtre, vederea Upcoming) → **Engage** (vederea Today).
- Obiect central: `Task` cu proprietăți plate (due date, priority, labels, project, parent task pentru sub-task-uri) — nu există concept de "status workflow" custom ca la Jira/ClickUp, doar done/not-done.
- Vederile (Today, Upcoming, Board, Calendar) sunt toate _proiecții_ diferite peste același set de task-uri, nu structuri de date separate — un task apare simultan în mai multe vederi fără duplicare.
- Filtrele sunt esența arhitecturii: în loc să creeze structuri fixe, Todoist lasă utilizatorul să-și definească propriile "vederi virtuale" printr-un query salvat.

---

## 3. Motion (usemotion.com)

**Ce face:** "Calendar AI" — combină task-uri + calendar, iar AI-ul plasează automat task-urile în sloturi libere din ziua ta, re-programând dinamic pe măsură ce apar schimbări.

**Puncte forte:**

- Auto-scheduling real: nu doar îți arată o listă, îți construiește literalmente ziua pe calendar.
- Respectă constrângeri ("nu programa nimic după ora 18" sau weekend) și rezervă blocuri de deep work.
- În 2025-2026 s-a extins spre "AI Employees" — agenți care preiau workflow-uri întregi, nu doar programare.

**Utilități / probleme rezolvă:**

- "Am o listă de task-uri dar nu știu CÂND să le fac" — Motion decide în locul tău.
- Elimină re-planificarea manuală zilnică când apar meeting-uri neprevăzute.

**Cum e construit (logica):**

- Task-urile au metadate obligatorii pentru algoritm: durată estimată, deadline, prioritate. Fără acestea, motorul de scheduling nu poate funcționa — sistemul forțează utilizatorul să estimeze totul.
- Motorul central e un solver de constrângeri: input = (task-uri + durate + deadline-uri + evenimente fixe din calendar + reguli utilizator) → output = un calendar populat, recalculat la fiecare schimbare.
- Diferența arhitecturală cheie față de Todoist/TickTick: aici calendarul e sursa de adevăr a "planului zilei", nu o listă separată — task-ul _este_ un eveniment de calendar cu flexibilitate de reprogramare.
- Risc cunoscut (confirmat de research-ul anterior din acest repo): utilizatorii se plâng când AI-ul le rearanjează ziua fără avertisment — feedback direct relevant pentru Moneo, care a ales explicit să NU facă auto-scheduling.

---

## 4. TickTick (ticktick.com)

**Ce face:** Task manager + calendar + Eisenhower Matrix + Pomodoro + habit tracker, toate într-o singură aplicație — practic un "Todoist + extra module".

**Puncte forte:**

- Foarte complet pentru un singur utilizator: acoperă task-uri, timp, obiceiuri, focus, fără să fie nevoie de 4 aplicații separate.
- Parsare inteligentă de dată din text natural.
- Matrice Eisenhower nativă (urgent/important) — vizualizare de prioritizare integrată, nu doar etichete.
- Preț mult sub Todoist/Motion pentru un set de funcții comparabil sau mai mare.

**Utilități / probleme rezolvă:**

- Utilizatori individuali (studenți, freelanceri) care vor "totul într-un loc" fără să plătească pentru 3-4 abonamente separate.
- Nu e gândit pentru echipe mari — explicit slăbește peste 3-4 oameni.

**Cum e construit (logica):**

- Arhitectură modulară pe deasupra unui core comun de task-uri: Habit Tracker, Pomodoro și Matricea Eisenhower sunt toate _lentile diferite_ peste același obiect `Task`/`Habit`, similar cu Todoist, dar cu module suplimentare native în loc de integrări terțe.
- Aceasta e exact combinația despre care Moneo a spus explicit "combinăm din tot ca să concurăm" — TickTick e dovada că modelul "un singur obiect central, module multiple deasupra" funcționează comercial la scară individuală.

---

## 5. Trello (trello.com)

**Ce face:** Board Kanban vizual — liste (coloane) + carduri (task-uri) care se mută prin drag-and-drop între stadii.

**Puncte forte:**

- Cea mai simplă interfață mentală posibilă pentru workflow: "board = proiect, listă = etapă, card = task".
- Curba de învățare aproape zero — de aceea are 50M+ utilizatori.
- Automatizare no-code (Butler) pentru reguli repetitive ("când cardul ajunge în Done, arhivează-l").
- Cardurile sunt containere flexibile: checklist-uri, atașamente, comentarii, câmpuri custom, due date — se pot transforma în mini-task-uri complete.

**Utilități / probleme rezolvă:**

- Echipe care vor vizibilitate instant asupra "cine face ce, în ce stadiu" fără training.
- Workflow-uri simple, liniare (to-do → doing → done) — nu proiecte complexe cu dependențe.

**Cum e construit (logica):**

- Model de date extrem de plat și explicit: `Board → List → Card`. Nicio abstracție ascunsă.
- Starea unui task = poziția lui fizică (index-ul listei în care se află cardul), nu un câmp "status" separat — mutarea cardului ESTE schimbarea de stare. Simplitate radicală.
- WIP limits (limite de câte carduri poate avea o listă) transformă o simplă listă vizuală într-un sistem Kanban real cu disciplină de flux.
- Totul e conceput ca "un singur ecran, o singură acțiune (drag)" — orice funcție nouă (automatizări, vederi Calendar/Timeline/Table) e adăugată STRICT ca o proiecție alternativă peste același model board/listă/card, nu ca o structură paralelă.

---

## 6. Asana (asana.com)

**Ce face:** Platformă de work management pentru echipe/organizații — coordonează task-uri, proiecte, obiective (goals) și workflow-uri cross-departamentale.

**Puncte forte:**

- "Work Graph" — un model de date relațional în care orice element de muncă (task, proiect, obiectiv, document) se poate lega de orice alt element, cu relații many-to-many.
- Multiple vederi peste același proiect: listă, board, timeline (Gantt), calendar — fără date duplicate.
- Goals/obiective legate direct de task-urile care le realizează — trasabilitate reală de la strategie la execuție zilnică (exact gap-ul pe care Moneo l-a rezolvat în Faza 9 pentru Goals↔Tasks).
- AI Teammates (2026): agenți care înțeleg contextul din Work Graph și pot semnala blocaje sau propune planuri de recuperare.

**Utilități / probleme rezolvă:**

- Companii cu echipe multiple care trebuie să vadă cum se leagă munca lor de obiectivele mari, fără "fragmentare informațională" (silozuri de Excel-uri și e-mailuri).
- Manageri care au nevoie de raportare de progres agregată automat din munca reală, nu actualizări manuale.

**Cum e construit (logica):**

- Nucleul arhitectural e Work Graph: fiecare "nod" (task, proiect, portofoliu, obiectiv, persoană) e un obiect de prim rang, iar relațiile dintre ele sunt cetățeni de prim rang și ele (nu chei străine ascunse).
- Consecință directă: o schimbare de progres la un task se propagă automat în sus prin graf — proiectul își recalculează progresul, obiectivul legat de proiect își recalculează progresul. Exact modelul de rollup pe care Moneo îl are deja pentru Goals (`goalProgress()`), dar Asana îl generalizează la ORICE tip de nod, nu doar goals→proiect→task.
- Vederile (List/Board/Timeline/Calendar) sunt pure funcții de randare peste graf — nu structuri separate de sincronizat.

---

## 7. ClickUp (clickup.com)

**Ce face:** "Totul-în-unul" pentru muncă — task management, documente, chat, obiective, time-tracking, 15+ tipuri de vizualizare, toate sub un singur acoperiș, cu AI (Brain2) care are context peste tot.

**Puncte forte:**

- Cea mai adâncă ierarhie configurabilă din categorie: Workspace → Spaces → Folders → Lists → Tasks → până la 7 nivele de subtask-uri.
- Custom Fields (dropdown, formule, relații) — practic o bază de date configurabilă deasupra task-urilor.
- Brain2 (2026): AI care are context din task-uri, documente, conversații, decizii — răspunde întrebări fără să cauți manual.
- Acoperă atât de multe cazuri de utilizare încât poate înlocui 5-6 alte instrumente pentru o echipă mică.

**Utilități / probleme rezolvă:**

- Echipe care s-au săturat să plătească pentru Asana + Notion + Slack + Toggl separat și vor un singur abonament.
- Organizații cu nevoi de raportare foarte specifice (custom fields + formule) pe care tool-urile rigide nu le pot acoperi.

**Cum e construit (logica):**

- Arhitectură ierarhică strictă (spre deosebire de graful flexibil al Asana): fiecare nivel conține strict nivelul de sub el — nu există relații "cross-cutting" native ca la Asana, în schimb ai adâncime nelimitată în interiorul unei singure ramuri.
- Custom Fields transformă orice `Task` într-un rând de bază de date cu schemă variabilă — de aici vine flexibilitatea, dar și complexitatea percepută ("prea multe butoane").
- Cele 15+ vederi sunt, la fel ca la Trello/Asana, proiecții asupra aceluiași set de task-uri filtrat pe ierarhia curentă — nu date separate.
- Compromisul arhitectural explicit: adâncime și configurabilitate maximă, cu prețul complexității UI — exact opusul filosofiei "calm, low-stimulus" pe care Moneo o urmărește (validat de cercetarea anterioară din acest repo).

---

## 8. Jira (atlassian.com/jira)

**Ce face:** Sistem de issue-tracking + management agil (Scrum/Kanban) construit inițial pentru echipe de dezvoltare software, azi extins la orice tip de proiect.

**Puncte forte:**

- Workflow-uri complet personalizabile — fiecare "issue" trece prin stări definite de organizație, cu tranziții, validări și automatizări la fiecare pas.
- Structură de tip WBS (Work Breakdown Structure) matură: Epic → Story → Task → Sub-task — exact terminologia pe care Moneo o folosește deja (Task cu `parentId`, WBS numbering în Timeline).
- Rapoarte agile native: burndown, velocity, sprint reports — Moneo are deja echivalente (`burndown()`, `velocity()` în `sprints.ts`).
- Extensibilitate prin Forge (platformă serverless de plugin-uri) — ecosistem uriaș de integrări enterprise.

**Utilități / probleme rezolvă:**

- Echipe de inginerie care au nevoie de trasabilitate strictă (cine a schimbat ce stare, când, de ce) pentru audit și conformitate.
- Organizații mari cu procese diferite pe echipă — fiecare echipă își definește propriul workflow fără să afecteze pe altcineva.

**Cum e construit (logica):**

- Totul e un "Issue" — Epic, Story, Task, Bug sunt doar _tipuri_ diferite de issue cu câmpuri diferite, nu entități separate în model.
- Workflow-ul e o mașină de stări explicită (state machine) atașată fiecărui tip de issue — tranzițiile sunt reguli de business configurabile, nu hardcodate. Aceasta e diferența majoră față de Trello (unde starea = poziția cardului) — la Jira starea e un câmp formal cu reguli de validare.
- Ierarhia (Epic conține Stories, Story conține Tasks) e o relație părinte-copil similară cu `parentId` din Moneo, dar cu tipuri diferite la fiecare nivel, nu recursivă ca la Moneo/ClickUp.

---

## 9. Clockify (clockify.me)

**Ce face:** Time-tracking gratuit/echipe, poziționat direct ca alternativă mai ieftină la Toggl, cu accent pe echipe mari și timesheet-uri.

**Puncte forte:**

- Plan gratuit generos (istoric: nelimitat; din 2026, limitat la 5 useri) — motorul de adopție principal.
- Tracking automat pasiv (aplicații/site-uri vizitate), stocat local pentru confidențialitate.
- Timesheet-uri cu flux de aprobare (submit → approve) — orientat spre HR/payroll, nu doar facturare individuală.
- Rapoarte de profitabilitate pe proiect (cost vs. timp facturabil).

**Utilități / probleme rezolvă:**

- Companii mijlocii/mari care au nevoie de timesheet-uri aprobate formal pentru payroll sau conformitate contractuală.
- Alternativă gratuită la Toggl pentru echipe cu buget redus.

**Cum e construit (logica):**

- Model de date aproape identic cu Toggl (Time Entry ca obiect central) — diferența e stratul organizațional deasupra: `Timesheet` agregă entries pe o perioadă (săptămână) și trece printr-un flux de aprobare cu stare proprie (draft → submitted → approved/rejected).
- Tracking-ul automat pasiv rulează ca un proces separat care generează _sugestii_ de time entries (din activitatea de sistem), pe care utilizatorul le confirmă/editează — nu creează entries direct, păstrând controlul manual final.

---

## 10. Monday.com (monday.com)

**Ce face:** "Work OS" — platformă de blocuri configurabile (boards, coloane, automatizări, integrări, agenți AI) din care orice echipă își construiește propriul sistem (CRM, PM, HR, etc.).

**Puncte forte:**

- Board-urile sunt complet configurabile la nivel de coloană (status, persoană, dată, formulă, dependență) — practic un spreadsheet inteligent cu automatizări.
- Workflows (2026): dincolo de automatizări simple "when X then Y", suportă condiții, întârzieri, date din pași anteriori — aproape un motor BPM light.
- AI Blocks + Sidekick: generare de board-uri din limbaj natural, sumarizare automată de status, sugestii de subtask-uri.
- Un singur produs poate servi simultan CRM de vânzări, tracking HR și management de proiect — configurație, nu module separate.

**Utilități / probleme rezolvă:**

- Organizații non-tehnice care vor să-și digitalizeze procese variate (vânzări, HR, operațiuni) fără să angajeze dezvoltatori.
- Nevoia de "un singur adevăr" când echipe diferite folosesc azi Excel-uri separate care nu comunică.

**Cum e construit (logica):**

- Unitatea fundamentală nu e "task-ul" ca la celelalte, ci **board-ul cu coloane tipizate** — fiecare rând dintr-un board e o entitate generică (poate fi task, poate fi client, poate fi angajat), iar coloanele îi dau sensul.
- Automatizările sunt reguli declarative separate de date: `trigger → condiție → acțiune`, stocate independent de board, ceea ce permite reutilizarea acelorași reguli pe board-uri multiple.
- Diferența arhitecturală esențială față de Asana/ClickUp: Monday nu presupune o ierarhie fixă de "proiect conține task-uri" — totul e un board generic, iar structura de business (proiect, task, dependență) e emergentă din configurația coloanelor, nu impusă de schemă.

---

## Rating pe părți (scală 1-10) + rating final

Criterii: **Design** (estetică vizuală/UI), **Font** (calitate tipografică/lizibilitate),
**Utilități** (completitudine funcțională), **Ușurință** (curba de învățare/UX zilnic),
**Preț/Valoare** (raport calitate-preț), **Performanță** (viteză/fiabilitate percepută),
**Recenzii** (scor real G2+Capterra, scalat la /10). **Final** = media simplă a celor 7.

| Produs          | Design | Font | Utilități | Ușurință | Preț/Valoare | Performanță | Recenzii* | **FINAL** |
| --------------- | ------ | ---- | --------- | -------- | ------------ | ----------- | --------- | --------- |
| **Toggl Track** | 9      | 8    | 6         | 10       | 8            | 9           | 9.3       | **8.5**   |
| **Todoist**     | 8      | 8    | 8         | 9        | 8            | 8           | 9.0       | **8.3**   |
| **Motion**      | 6      | 6    | 9         | 5        | 5            | 7           | 8.0       | **6.6**   |
| **TickTick**    | 8      | 7    | 9         | 8        | 10           | 8           | 9.1       | **8.4**   |
| **Trello**      | 9      | 8    | 6         | 10       | 8            | 8           | 8.9       | **8.3**   |
| **Asana**       | 8      | 7    | 9         | 7        | 6            | 7           | 8.8†      | **7.5**   |
| **ClickUp**     | 6      | 6    | 10        | 5        | 8            | 6           | 9.2       | **7.2**   |
| **Jira**        | 6      | 6    | 9         | 5        | 7            | 7           | 8.7       | **7.0**   |
| **Clockify**    | 7      | 7    | 7         | 9        | 10           | 8           | 9.5       | **8.2**   |
| **Monday.com**  | 9      | 8    | 9         | 7        | 6            | 7           | 9.4       | **7.9**   |

\* Recenzii = medie G2+Capterra ×2 (din scoruri /5 reale, verificate web sept. 2026): Toggl 4.6/4.7,
Todoist 4.5/~4.6, Motion 4.1 (G2, singurul disponibil), TickTick 4.5/4.7, Trello ~4.4/4.5,
ClickUp 4.7/~4.6, Jira 4.3/4.4, Clockify ~4.5/4.8, Monday 4.7/4.7.
† Asana: scorul exact G2/Capterra nu a fost confirmat direct în căutare (paginile există dar
fără cifra afișată) — 8.8 e o estimare din reputația general cunoscută (~4.3-4.4/5), de verificat
manual pe g2.com/products/asana dacă precizia contează.

### Comentarii scurte pe fiecare, în context de design/font/utilități

- **Toggl** — design minimalist aproape perfect pentru scopul lui restrâns; penalizat la Utilități pentru că face STRICT time-tracking, nimic altceva.
- **Todoist** — font/design "sigure", fără personalitate — funcțional dar interschimbabil vizual cu orice alt to-do app generic.
- **Motion** — cel mai slab scor per total: utilitate mare (auto-scheduling real) anulată de ușurință mică și preț mare; fontul/design-ul sunt aglomerate de multele panouri simultane.
- **TickTick** — cel mai bun raport preț/utilități din toată lista; design colorat și prietenos, nu impresionant dar eficient.
- **Trello** — design-ul e motorul adopției (culori, simplitate) — dar exact simplitatea care-l face ușor îl face insuficient pentru proiecte complexe (Utilități 6).
- **Asana** — echilibrat pe toate axele, fără să exceleze la niciuna; scump per scaun la scară, ceea ce-i scade Preț/Valoare.
- **ClickUp** — cele mai multe utilități din listă (10/10), dar exact asta produce scorurile mici la Design/Font/Ușurință — prea multe butoane, densitate vizuală mare, curbă de învățare abruptă.
- **Jira** — arată vizibil "enterprise/utilitar", nu a fost niciodată gândit să fie frumos; excelează strict la trasabilitate și workflow pentru echipe tehnice.
- **Clockify** — cel mai mare scor de recenzii (9.5) — corelat probabil cu planul gratuit generos, nu neapărat cu superioritate de design.
- **Monday.com** — cel mai "frumos" din categoria PM/work-OS (design 9), dar prețul pe seat crește rapid la scară, iar flexibilitatea totală cere setup.

---

## Sinteză — tipare arhitecturale recurente (relevante pentru Moneo)

| Tipar                                                      | Cine îl folosește               | Ce înseamnă pentru Moneo                                                                                                                                                                                                                             |
| ---------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Un obiect central + vederi multiple ca proiecții**       | Todoist, Trello, Asana, ClickUp | Moneo face deja asta (`Task` cu `parentId`, aceleași task-uri apar în Board/Sprints/Timeline/Waterfall) — arhitectura de bază e corectă, aliniată cu liderii pieței.                                                                                 |
| **Starea = poziție fizică, nu câmp separat**               | Trello                          | Simplitate radicală — de luat în calcul pentru un mod "simplu" opțional în Board-ul Moneo.                                                                                                                                                           |
| **Graf relațional cu rollup automat**                      | Asana (Work Graph)              | Moneo are deja acest tipar la scară mică (`goalProgress()` rollup Goals→Project→Task, Faza 9 din acest repo) — extinderea lui la OKR↔Goals (menționată ca "deferred" în planul curent) ar alinia Moneo cu modelul Asana.                             |
| **Ierarhie adâncă + custom fields**                        | ClickUp                         | Cel mai flexibil, dar și cel mai aglomerat vizual — exact riscul pe care Moneo l-a evitat conștient (research anterior: "complexity backlash" Motion/ClickUp vs. simplitate Akiflow).                                                                |
| **Board generic + coloane tipizate**                       | Monday.com                      | Model foarte diferit de Moneo — nepotrivit pentru un produs local-first, personal, cu identitate de "focus tool", nu "platformă no-code".                                                                                                            |
| **Time-tracking ca obiect complet separat de planificare** | Toggl, Clockify                 | Moneo combină deja timer + task-uri + proiecte nativ (spre deosebire de Toggl care refuză explicit să facă PM) — acesta e un avantaj de poziționare, nu un gap.                                                                                      |
| **Auto-scheduling AI**                                     | Motion                          | Deja analizat și respins conștient de Moneo (Faza 10, calendar read-only) — confirmat din nou aici ca sursă de fricțiune la utilizatori, nu doar presupunere.                                                                                        |
| **Workflow ca mașină de stări explicită**                  | Jira                            | Moneo are `TaskStatus` fix (pending/in_progress/blocked/completed) — Jira arată că star wars-urile custom (workflow-uri definite de utilizator) sunt valoroase mai ales la scară enterprise; probabil peste scopul unui produs local-first personal. |

**Recomandare de ansamblu:** Moneo combină deja corect tiparele validate de piață (obiect central + vederi multiple, rollup ierarhic, timer+PM unificat) și evită conștient capcanele cunoscute (auto-scheduling agresiv, aglomerare ClickUp-style). Cel mai valoros pas următor din acest research: extinderea graf-ului de rollup (stil Asana) dincolo de Goals→Project→Task, spre OKR↔Goals — genul de "conexiune profesională între module" cerut explicit în Faza 9, dar lăsat deliberat în afara scopului atunci.

---

## Runda 2 — surse suplimentare pentru viteză, învățare și motivație

Cei 10 din runda 1 acoperă bine "organizare a muncii", dar nu acoperă deloc două cerințe explicite: **"să lucrezi mult și repede"** (viteză extremă de utilizare) și **"să te dezvolți, să înveți repede"** (motivație/progres pe termen lung). Am analizat 6 produse alese special pentru astea.

### 11. Linear (linear.app)

**Ce face:** Issue-tracker pentru echipe de dezvoltare — dar renumit nu pentru funcții, ci pentru viteza brută și disciplina de design.

**Puncte forte:** randare sub 100ms la orice acțiune; motor de sincronizare **local-first** (starea trăiește pe device, sincronizează în fundal — arhitectural identic cu ce are deja Moneo); paletă de comenzi globală `Cmd+K`; navigare aproape 100% de la tastatură (`/` filtrează instant, `E` asignează/mută un issue în secunde); UI "opinionated" — refuză board-uri drag-and-drop libere în favoarea unor workflow-uri structurate, ca să nu lase loc de configurare inutilă.

**Ce rezolvă:** fricțiunea dintre "am un gând" și "task-ul e creat/actualizat" — la Linear diferența e de milisecunde și zero click-uri de mouse.

**De unde luăm:** **o paletă de comenzi globală (Cmd/Ctrl+K)** — cel mai direct transferabil element din tot research-ul. Moneo are deja `Search... (/)` în TopNav; o comandă unificată care combină căutare + acțiuni rapide ("creează task", "pornește timer", "mergi la Proiecte", "adaugă la Ivy Lee") ar muta Moneo direct în categoria "instrumente rapide", nu doar "instrumente complete".

### 12. Superhuman (superhuman.com)

**Ce face:** Client de email — dar produsul e de fapt o filosofie de design: "regula de 100ms", totul cu shortcut de tastatură (100+ comenzi), niciodată nu devine "all-in-one".

**Puncte forte:** disciplină obsesivă pe un singur lucru făcut extrem de bine, în loc să adauge funcții; shortcut-uri de tastatură pentru literalmente fiecare acțiune (arhivare, snooze, căutare, navigare).

**Ce rezolvă:** "email-ul e lent, iar întârzierea dintre acțiuni e cea mai reparabilă pierdere de productivitate din munca de birou" — exact tipul de fricțiune pe care un Pomodoro-tool o poate elimina la fel de bine pentru task-uri.

**De unde luăm:** **extinderea shortcut-urilor de tastatură dincolo de Space/R** (deja există la timer) — la nivelul întregii aplicații: `N` = task nou, `G apoi P` = mergi la Proiecte (pattern Gmail/Linear de "go-to"), `C` = completează task-ul selectat. Contrabalans important: Superhuman arată și riscul opus al strategiei Moneo — "combinăm din tot" e corect ca poziționare, dar fiecare funcție nouă trebuie să respecte regula de 100ms, altfel viteza promisă devine doar un slogan.

### 13. Obsidian (obsidian.md)

**Ce face:** Sistem personal de gestionare a cunoștințelor (PKM) — notițe locale în Markdown simplu, conectate prin linkuri bidirecționale `[[Notiță]]`, vizualizate ca un graf.

**Puncte forte:** **100% local-first** (fișiere Markdown pe disc, nu bază de date proprietară — filosofie identică cu Moneo); graful vizual arată relațiile dintre idei și scoate la iveală goluri de cunoaștere; arhitectură de plugin-uri extrem de extensibilă; în 2026 a adăugat "Bases" — vederi de tip bază-de-date complet offline, peste aceleași fișiere text.

**Ce rezolvă:** fragmentarea cunoașterii personale — ideile, deciziile, notele de proiect nu mai trăiesc izolat, ci se leagă organic unele de altele, iar graful arată tiparul.

**De unde luăm — cea mai originală idee din tot research-ul:** **linkuri bidirecționale între entitățile Moneo** (`[[Goal]]` ↔ `[[Project]]` ↔ `[[Journal entry]]` ↔ `[[Skill]]`) + o **vedere-graf** a propriei productivități. Niciun concurent din runda 1 nu face asta. Ar transforma cererea "ajută să te dezvolți" din slogan în literal: vezi cum o intrare din jurnal se leagă de un obiectiv, care se leagă de un skill în dezvoltare, care se leagă de proiectele unde l-ai aplicat. E exact genul de "conexiune profesională între module" pe care ai cerut-o încă din Faza 9, dus la următorul nivel — nu doar rollup numeric (progres %), ci conexiune vizibilă și navigabilă.

### 14. Habitica (habitica.com)

**Ce face:** Transformă obiceiuri/task-uri într-un joc RPG — avatar, experiență (XP), aur, echipament; task-urile completate = progres de personaj, task-urile ratate = pierdere de viață.

**Puncte forte:** gamification completă și coerentă narativ (nu doar puncte, ci un "personaj" care evoluează); consecințe reale pentru eșec (pierzi viață/echipament), nu doar recompense pentru succes — creează miză reală, nu doar felicitări goale; funcții sociale (guilde, petreceri, boss-uri de grup) pentru accountability.

**Ce rezolvă:** motivația pe termen lung pentru obiceiuri plictisitoare — "de ce să fac asta azi" primește un răspuns emoțional (personajul meu, echipa mea), nu doar rațional.

**De unde luăm:** Moneo are deja Growth (stagii gamificate) și Skills tracking — Habitica arată cum se **leagă XP-ul de un sistem de progres vizibil pe termen lung**, nu doar de un streak zilnic. Recomandare concretă: XP pe Skill (fiecare sesiune de focus alocată unui skill crește nivelul acelui skill specific, nu doar un scor global), plus un "eveniment mare" (echivalentul unui boss) legat de finalizarea unui Milestone din Goals. **Atenție la tensiune:** mecanismul de pedeapsă (pierdere de viață) contrazice direct poziționarea "calm, low-stimulus" deja validată — de adaptat doar partea de recompensă/progres, nu și partea punitivă.

### 15. Duolingo (duolingo.com)

**Ce face:** Aplicație de învățat limbi — cel mai studiat exemplu de gamification din industrie pentru retenție zilnică.

**Puncte forte:** streak-uri (aversiunea la pierdere e mai puternică decât atracția câștigului — testat pe 300M utilizatori); recompense variabile (XP imprevizibil per lecție, ca la sloturi — ține atenția); ligi/leaderboard-uri care potrivesc oameni cu activitate similară (competiția pare câștigabilă, nu descurajantă); personalizare AI a dificultății în 2026.

**Ce rezolvă:** "știu că ar trebui, dar nu am chef azi" — Duolingo face revenirea zilnică mai ieftină emoțional decât abandonul streak-ului.

**De unde luăm:** Moneo are deja `stats.streak` (confirmat în StatsCard) — de extins cu **recompensă variabilă** (XP/puncte de Growth ușor imprevizibile per sesiune finalizată, nu fix) și, dacă se adaugă vreodată un strat social minim, **ligi mici bazate pe volum de focus similar** (nu clasament global brutal, ci grupuri mici unde competiția pare câștigabilă) — dar asta e o investiție mare (infrastructură socială), de pus pe roadmap-ul lung, nu imediat.

### 16. Notion (notion.com)

**Ce face:** Workspace "totul-e-un-bloc" — notițe, baze de date, wiki, task-uri, toate din aceleași blocuri combinabile.

**Puncte forte:** un singur loc pentru tipuri foarte diferite de muncă, în loc de 4 aplicații separate; flexibilitate totală de structură.

**Ce rezolvă:** fragmentarea instrumentelor — dar cu prețul unei complexități de configurare mari (exact riscul deja semnalat la ClickUp).

**De unde luăm — cu măsură:** nu arhitectura de bloc completă (prea grea, contrazice simplitatea Moneo), ci ideea restrânsă deja recomandată în runda 1: **un singur doc Markdown simplu per proiect** pentru context/decizii, nu un editor de blocuri complet.

---

## Master-listă finală — ce împrumutăm și de unde (runda 1 + runda 2)

| #   | Idee                                                                         | Sursă                             | Efort             | Se potrivește cu identitatea Moneo?                                        |
| --- | ---------------------------------------------------------------------------- | --------------------------------- | ----------------- | -------------------------------------------------------------------------- |
| 1   | **Paletă de comenzi globală (Cmd/Ctrl+K)**                                   | Linear, Superhuman                | Mic-mediu         | Da — extinde ce există deja (`/` search)                                   |
| 2   | **Shortcut-uri de tastatură la nivel de aplicație**                          | Superhuman, Linear                | Mic (incremental) | Da — Moneo are deja Space/R                                                |
| 3   | **Linkuri bidirecționale + vedere-graf între Goals/Projects/Journal/Skills** | Obsidian                          | Mare              | Da, foarte mult — idee de diferențiere reală, nimeni din categorie n-o are |
| 4   | **Filtre salvate / Smart Views**                                             | Todoist                           | Mic-mediu         | Da                                                                         |
| 5   | **Legătura OKR↔Goals (rollup generalizat)**                                  | Asana (Work Graph)                | Mediu             | Da — deja pe roadmap din Faza 9                                            |
| 6   | **XP pe Skill + "eveniment mare" la Milestone**                              | Habitica (fără mecanica punitivă) | Mediu             | Da, cu adaptare — păstrează doar recompensa, nu pedeapsa                   |
| 7   | **Recompensă variabilă pe streak/sesiune**                                   | Duolingo                          | Mic               | Da                                                                         |
| 8   | **Automatizări simple tip "when X then Y"**                                  | Trello Butler                     | Mediu             | Da, dacă rămâne strict minimal                                             |
| 9   | **Doc Markdown simplu per proiect**                                          | Notion (redus), ClickUp Docs      | Mic-mediu         | Da                                                                         |
| 10  | **Portofolii (grupare multi-proiect)**                                       | Asana                             | Mediu             | Parțial — prioritate mai mică pt. un tool personal                         |
| 11  | **Sugestie de slot (non-destructivă)**                                       | Motion (versiune blândă)          | Mare              | Cu grijă — linia unde poate aluneca spre auto-scheduling respins deja      |
| 12  | Custom fields generice                                                       | ClickUp                           | Mare              | Nu recomandat — riscul de complexitate deja documentat                     |
| 13  | Ligi/leaderboard social                                                      | Duolingo                          | Foarte mare       | Nu acum — infrastructură socială, roadmap lung                             |
| 14  | Auto-tracking pasiv de activitate                                            | Clockify                          | Mare              | Tensiune cu local-first/privacy — nu recomandat                            |

**Recomandarea mea de ordine, dacă vrei "cel mai mare impact pentru un produs premium care schimbă tot":**

1. **#3 (linkuri + graf)** — asta ESTE elementul care te-ar diferenția vizibil de toți cei 16 analizați, nimeni din categoria productivitate nu combină local-first + graf de cunoștințe + task/goal tracking real.
2. **#1+#2 (paletă comenzi + shortcut-uri)** — cel mai vizibil "se simte premium/rapid" din prima secundă de utilizare, efort rezonabil.
3. **#6+#7 (XP pe skill + recompensă variabilă)** — răspunde direct la "ajută să te dezvolți/înveți", reutilizează Growth/Skills deja existente.

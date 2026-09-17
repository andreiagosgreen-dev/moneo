# Moneo — Roadmap de implementare pentru Muse Spark 1.3

## Rolul produsului

Moneo este un **focus companion local-first**: ajută oamenii să aleagă ce contează acum, să lucreze profund și să vadă cum acțiunile mici construiesc o viață echilibrată. Nu transforma produsul într-un dashboard corporatist sau într-o listă de funcții. Fiecare ecran trebuie să aibă o acțiune principală foarte clară.

## Reguli de lucru

- Păstrează React + TypeScript + Vite + Tailwind existente.
- Nu rescrie module funcționale doar pentru stil. Fă modificări mici, testabile și păstrează API-urile existente când este posibil.
- După fiecare etapă: rulează `npm run build:ci` și `npm run lint`.
- Nu expune chei, secrete sau service-role keys în frontend.
- Păstrează local-first: aplicația trebuie să funcționeze integral fără cont.
- Respectă `prefers-reduced-motion`; animațiile trebuie să fie opționale, nu obligatorii pentru utilizare.
- Nu folosi carduri în interiorul altor carduri fără un motiv clar. Spațiul, tipografia și straturile subtile sunt preferate bordurilor excesive.

---

## Faza 0 — Blocaje de lansare și corectitudine

### 0.1 Ștergerea reală a contului

**Problemă:** acțiunea actuală „Delete account” nu șterge utilizatorul din Supabase Auth și nu elimină explicit `user_settings` sau `subscriptions`.

**Implementare:**

1. Creează o Supabase Edge Function sau un endpoint Worker sigur pentru ștergere de cont.
2. Verifică JWT-ul utilizatorului; nu accepta un `user_id` arbitrar din client.
3. Șterge toate datele utilizatorului, inclusiv setările și abonamentele.
4. Apelează server-side `auth.admin.deleteUser(userId)` cu service-role, doar în backend.
5. Golește datele locale ale utilizatorului numai după succesul confirmat.
6. Schimbă UI-ul în confirmare explicită: „Această acțiune șterge definitiv contul și datele sincronizate.”

**Criterii de acceptare:** utilizatorul nu se mai poate autentifica după confirmare; niciun rând asociat nu rămâne în tabelele cloud; o eroare nu șterge accidental date locale.

### 0.2 Upgrade React Router

**Problemă:** auditul npm raportează vulnerabilități moderate în React Router.

**Implementare:** actualizează `react-router-dom` la o versiune remediată, adaptează API-urile incompatibile, verifică rutele `/`, `/help`, `/privacy`, `/terms` și linkurile interne.

**Criterii:** `npm audit --omit=dev --audit-level=high` nu mai raportează vulnerabilitățile React Router; build și testele trec.

### 0.3 Lemon Squeezy: plan lunar vs anual

**Problemă:** planurile folosesc același checkout URL, fără `variant_id` distinct.

**Implementare:**

- Adaugă variabile separate: `VITE_LEMONSQUEEZY_MONTHLY_VARIANT_ID` și `VITE_LEMONSQUEEZY_YEARLY_VARIANT_ID`.
- Generează URL-ul de checkout cu varianta corectă și `custom[user_id]` URL-encoded.
- În Worker acceptă doar evenimente Lemon Squeezy de tip subscription, validează schema și tratează idempotent retry-urile.

**Criterii:** alegerea fiecărui plan deschide varianta corectă; activare, anulare, expirare și reînnoire actualizează corect abonamentul.

### 0.4 Email notifications

**Problemă:** serviciul actual este stub și poate raporta succes fără request.

**Implementare:** nu promova email notifications până nu există Edge Function + provider. Backend-ul trebuie să fie singurul care comunică cu providerul de email.

---

## Faza 1 — Refactor și performanță

### 1.1 Elimină duplicările sigure

- Extrage `readEnv()` din Supabase, Lemon Squeezy și email într-un helper comun.
- Extrage `withClient()` din repository-urile cloud într-un helper comun.
- Nu schimba comportamentul de fail-closed/fail-safe actual; adaugă teste pentru helperii extrași.

### 1.2 Sparge componentele prea mari

Ținte:

- `src/App.tsx`: separă în hook-uri `useTimer`, `useAppPersistence`, `useDeadlineReminders`, `usePlannerState`.
- `ProjectsCard.tsx`: separă listă proiecte, detaliu proiect, task hierarchy, filtre și atașamente.
- `AgileCard.tsx`: separă kanban, sprinturi, retrospective, waterfall.
- `LifeCard.tsx`: separă habits, balance, journal, energy.

Nu este obligatoriu să fie mici artificial; scopul este ca fiecare modul să aibă o singură responsabilitate și teste ușor de scris.

### 1.3 Code splitting

Lazy-load tab-urile care nu sunt necesare la prima încărcare: Plan, Growth, Projects, Reports și componentele de billing/Supabase. Păstrează Focus rapid și disponibil offline.

**Țintă:** elimină warning-ul Vite pentru chunkul >500 kB și măsoară prima încărcare pe mobil.

---

## Faza 2 — Core experience simplificat

### Principiu

Primul traseu trebuie să fie:

`Aleg o intenție → fac focus → văd progresul → decid următorul pas.`

### Modificări

- Focus este ecranul implicit și are o singură acțiune dominantă: Start.
- Today arată doar: top 3 priorități, următorul bloc de focus și o recomandare. Restul funcțiilor sunt progresive/pliabile.
- Mută matricea Eisenhower, calendarul avansat, OKR, Skills, Agile și waterfall în zone „Advanced planning” sau introdu-le treptat după primele sesiuni/proiecte.
- În stările goale, arată mai întâi o acțiune utilă; upsell-ul Pro se arată doar lângă funcția blocată.
- Pe mobil, tab-urile ascunse trebuie accesibile printr-un meniu `More` sau un indicator vizual clar de scroll.

---

## Faza 3 — Funcția semnătură: Harta Vieții

### Obiectiv

Construiește o experiență interactivă care conectează focusul zilnic cu echilibrul de viață. Nu este o diagramă decorativă; trebuie să conducă utilizatorul către următoarea acțiune utilă.

### Model de date

Adaugă `LifeMapArea`:

```ts
type LifeMapArea = {
  id: string;
  name: string;
  color: string;
  icon: string;
  currentScore: number; // 1..10
  desiredScore: number; // 1..10
  importance: number; // 1..5
  intention: string;
  linkedGoalIds: string[];
  linkedProjectIds: string[];
  linkedHabitIds: string[];
  createdAt: number;
  updatedAt: number;
};
```

Persistă local-first. Dacă sync-ul nu este extins în aceeași livrare, spune explicit că Harta Vieții este locală; nu pretinde sync cross-device.

### Constructorul Hărții Vieții

1. Ecran de start cu șabloane: `Balanced life`, `Student`, `Freelancer`, `Founder`, `Recovery` și `Blank`.
2. Utilizatorul adaugă/reordonează arii: Sănătate, Carieră, Bani, Relații, Familie, Învățare, Creativitate, Odihnă etc.
3. Pentru fiecare arie setează scor curent, scor dorit, importanță și o intenție de o propoziție.
4. Leagă aria de obiective, proiecte și habits deja existente.
5. Harta sugerează „următorul pas de 10 minute” pentru zona cea mai importantă și neglijată.

### Vizualizarea principală

- Radial/wheel chart cu 6–10 segmente. Lungimea segmentului = scor actual; contur luminos = scor dorit; intensitatea culorii = importanță.
- Centrul arată `Life balance` și o propoziție de insight, nu o listă de metrici.
- Click/tap pe un segment deschide un panou de detaliu cu: intenția ariei, progres, legături și o acțiune primară.
- Nu folosi o bibliotecă grea dacă SVG/CSS poate realiza graficul accesibil. Adaugă alternativă textuală pentru screen readers.

### Review săptămânal

- „Ce a primit atenția ta?” bazat pe sesiuni/proiecte/habits legate.
- „Ce ai neglijat?” fără ton moralizator.
- Utilizatorul poate crea o acțiune, un habit sau un bloc de focus direct din insight.

**Criterii:** un utilizator nou poate construi prima hartă în sub 2 minute, poate modifica o arie, poate lega un obiectiv și poate crea o acțiune din hartă.

---

## Faza 4 — Design futuristic, calm și plăcut

### Direcție de artă

Păstrează baza dark premium, dar fă-o mai spațială și vie: **midnight graphite**, verde-jad, auriu cald, albastru electric discret. Stilul este „instrument de concentrare din viitor”, nu cyberpunk agresiv și nu gaming UI.

### Sistem vizual

- Fundal: gradient foarte subtil + grilă fină + grain redus; fără mișcare continuă agresivă.
- Suprafețe: sticlă fumurie/metal mat, blur moderat, borduri foarte subtile, umbre mari și moi.
- Tipografie: maxim două familii. Păstrează corpul de text foarte lizibil; mono doar pentru timp, date și etichete mici.
- Accent: un singur accent dominant per stare. Focus = aur cald, pauză = jad, reflecție = violet/albastru.
- Spațiu: mai mult whitespace, mai puține carduri, ierarhie tipografică mai puternică.

### Efecte și motion

- Timerul are un arc luminos care respiră lent doar când sesiunea rulează.
- La Start: tranziție scurtă în „focus mode”; navigația și elementele secundare se estompează.
- La final: puls calm, sunet opțional, rezumat de 10 secunde. Fără confetti generic.
- Harta Vieții: segmentele apar gradual, iar hover/tap produce o aură și ridică segmentul cu 2–4 px.
- Butoane: feedback tactil subtil (`scale` mic, 120–180ms), fără bounce excesiv.
- Folosește transform/opacity pentru animații; evită animații care declanșează layout continuu.
- `prefers-reduced-motion`: oprește particulele, pulsul și tranzițiile mari; păstrează numai schimbările de stare clare.

### Responsivitate

- Mobile-first pentru Harta Vieții: hartă radială mare, panou de detaliu bottom-sheet.
- Desktop: hartă în stânga, acțiunea următoare și detaliul ariei în dreapta.
- Testează 360px, 390px, 768px, 1024px și desktop; testează zoom 200%.

---

## Faza 5 — Multilanguage (i18n)

### Limbi obligatorii

- English (`en`)
- Română (`ro`)
- Русский (`ru`)
- Українська (`uk`)
- Deutsch (`de`)
- Italiano (`it`)
- Français (`fr`)
- Español (`es`)

### Cerințe

- Nu lăsa texte hardcodate în componente noi sau modificate.
- Folosește chei semantice, de exemplu `focus.start`, `lifeMap.balanceScore`, nu propoziții întregi ca chei.
- Nu traduce identificatori, date brute sau valori stocate. Tradu numai UI-ul.
- Locale-ul afectează data, ora, numerele, monedele și pluralizarea prin `Intl`.
- Limba aleasă se salvează local și poate fi sincronizată doar când sync-ul de setări este corect configurat.

### UX

- Selector de limbă în Settings.
- Româna este completă, cu diacritice corecte: „Învățare”, „Șterge contul”, „Astăzi”.
- Nu amesteca limbile în același ecran; denumirile de proiecte și datele utilizatorului rămân neschimbate.
- Testează texte lungi în germană, franceză, italiană, rusă și ucraineană în butoane, dialoguri, mobile și layout-uri dense.
- Folosește traduceri revizuite uman pentru ecranele legale, ștergerea contului, plăți și erori; nu utiliza traducere automată la runtime pentru informații critice.

---

## Faza 5A — Securitate și mentenanță premium

### Principiu

Securitatea este defense-in-depth: nici frontendul, nici o regulă izolată, nici un secret nu trebuie să fie unicul punct de protecție. Aplicația trebuie să eșueze sigur, să fie actualizabilă și să limiteze efectul oricărei breșe.

### Autentificare și autorizare

- Păstrează RLS strict pentru fiecare tabel nou; niciodată `using (true)` sau politici anonime pentru date private.
- Pentru fiecare entitate nouă (Life Map, proiect, task, habit), adaugă `user_id`, index potrivit și politici CRUD per proprietar.
- Nu permite clientului să decidă planul Pro, user role, accesul la date sau ștergerea Auth.
- Operațiile administrative (delete user, billing webhook, email) rulează doar server-side, cu secrete în environment-ul platformei.
- Cere recent authentication / reconfirmarea parolei înainte de operații foarte sensibile când providerul o permite.

### Apărare web

- Configurează Content Security Policy restrictivă, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` și HTTPS strict în infrastructură.
- Evită `dangerouslySetInnerHTML`; validează și sanitizează orice text care poate deveni HTML, URL sau export.
- Validează toate intrările atât în client pentru UX, cât și în backend/database pentru securitate.
- Pentru linkuri atașate de utilizatori, permite numai scheme sigure `https:`/`http:` și deschide extern cu `noopener,noreferrer`.
- Adaugă rate limiting și protecție anti-abuz pentru endpointurile AI, login, webhook și email.
- Verifică webhook-uri prin HMAC, timestamp/replay protection și allowlist de evenimente.

### Secrete, date și privacy

- Nicio cheie secretă în Vite/frontend, Git, console logs sau rapoarte de eroare.
- Folosește `.env.example` fără valori reale și secret scanning pre-commit/CI.
- Minimizează datele trimise la AI: trimite doar contextul necesar, cu consimțământ explicit înainte de primul apel AI.
- Oferă export, ștergere, explicația datelor sincronizate și retenție clară.
- Local storage este convenabil, dar nu este criptare: previne XSS cu CSP și input handling, nu promite „date criptate local” fără implementare reală.

### Mentenanță continuă

- CI obligatoriu: typecheck, lint, teste, build, dependency audit și secret scan la fiecare pull request.
- Dependabot/Renovate pentru dependențe, cu actualizări mici și regulate.
- Teste de integrare pentru RLS, billing, account deletion și sync.
- Teste E2E pentru Focus, Today, Harta Vieții, i18n, Account și checkout în sandbox.
- Observabilitate fără PII: erori agregate, health checks, audit logs pentru operații sensibile și alertă la eșecuri webhook.
- Backups verificate periodic și procedură documentată de restore.

---

## Faza 6 — AI Planning Companion

### Obiectiv

AI-ul trebuie să fie un **asistent de execuție**, nu doar un chat. Primește un obiectiv mare și construiește drumul: rezultat → ani/trimestre → luni → săptămâni → zile → sesiuni Pomodoro. Apoi adaptează planul după timpul real, energie și progres.

### Ce poate face AI-ul

1. Primește un scop mare, de exemplu: „Vreau să devin frontend developer în 12 luni” sau „Lansez un produs în 6 luni”.
2. Clarifică doar ce lipsește: termen, nivel curent, ore disponibile, constrângeri, rezultat măsurabil.
3. Creează o structură: vision → anual → trimestrial → lunar → săptămânal → zilnic.
4. Împarte fiecare rezultat în proiecte, milestone-uri, task-uri și sesiuni Pomodoro estimate.
5. Construiește un curriculum de învățare: ce se învață, în ce ordine, ce se practică și cum se validează progresul.
6. Planifică realist după capacitate, calendar, energie și WIP; nu umple ziua artificial.
7. Replanifică după fiecare review: ce s-a terminat, ce este blocat, ce se mută, ce trebuie eliminat.
8. Explică *de ce* recomandă următoarea acțiune și cât contribuie aceasta la obiectiv.

### Rolul de coach și motivator

AI-ul vorbește ca un partener calm de progres, nu ca un supraveghetor. El trebuie să ajute utilizatorul să înceapă, să rămână consecvent și să revină după o zi ratată, fără rușinare sau mesaje generice.

- Dimineața: oferă o recomandare scurtă, de exemplu: „Ai 50 de minute bune înainte de prima întâlnire. Începe lecția de React care deblochează proiectul tău.”
- Înainte de un bloc programat: notificare cu task-ul, intenția și primul pas concret: „Deschide exercițiul 3; obiectivul este să termini funcția, nu modulul complet.”
- La blocaj: propune o versiune mai mică: 10 minute, un Pomodoro sau un singur exercițiu.
- După o sesiune: recunoaște progresul specific și leagă efortul de obiectiv, fără elogii goale.
- După absență: replanifică blând: „Ai ratat două blocuri. Nu recuperăm tot azi; alegem un pas important de 25 minute.”
- La review: arată progresul real, obstacolele și următoarea decizie.

### Notificări și sunete

- Notificările sunt opt-in explicit; aplicația nu cere permisiunea la primul load.
- La activare, utilizatorul alege: ore active, zile active, quiet hours, tipul reminderului și sunetul.
- Tipuri: `start learning`, `next focus block`, `break`, `weekly review`, `gentle restart`, `milestone`.
- Fiecare notificare include o singură acțiune clară: `Start 25 min`, `Snooze 10 min`, `Reschedule` sau `Open plan`.
- Limitează frecvența: fără spam; maximum configurabil, implicit 2 remindere proactive/zi plus alarmele sesiunilor active.
- Folosește sunete scurte, calme și configurabile; fără alarme agresive. Oferă test audio și mod silențios.
- Respectă browser permissions, `prefers-reduced-motion`, Do Not Disturb când API-ul/OS-ul permite și nu pretinde livrare garantată a notificărilor dacă browserul este închis.
- Pentru reminder-uri fiabile când aplicația nu este deschisă, planifică push notifications cu service worker și backend; nu promite acest comportament doar cu `setInterval` din browser.

### Învățare accelerată — cadrul „20 de ore”

Folosește regula ca un cadru motivațional practic, nu ca promisiune universală: aproximativ 20 de ore de practică deliberată pot duce un începător la autonomie de bază într-o abilitate bine definită; măiestria cere mult mai mult și depinde de domeniu.

Pentru fiecare skill, AI-ul creează un `20-hour sprint`:

1. Definește abilitatea îngustă și un rezultat observabil: de exemplu, „pot construi și publica o pagină React responsive”, nu „învăț React”.
2. Împarte cele 20 de ore în 40 Pomodoro de 25 minute sau în sesiuni configurabile.
3. Alege 3–5 sub-abilități cu impact mare prin principiul 80/20.
4. Convertește fiecare sub-abilitate în exerciții și proiecte mici cu feedback.
5. Programează sesiunile după capacitatea reală a utilizatorului.
6. După fiecare sesiune, salvează: ce s-a practicat, dificultatea, rezultatul și următorul pas.
7. După 5, 10, 15 și 20 de ore, creează checkpoint-uri cu dovadă practică: exercițiu, mini-proiect, demo sau quiz.

### Exemple de experiențe de învățare

- **Learn React in 20 hours:** component basics → state/events → effects/data → responsive UI → proiect mic publicat.
- **Learn English speaking:** vocabular de bază → shadowing → conversații scurte → feedback → simulare reală.
- **Learn design:** ierarhie → spacing → culoare → copiere controlată a unui ecran → proiect propriu.

Nu inventa resurse sau certifică progres fără dovadă. AI-ul trebuie să distingă între `am citit`, `am exersat` și `pot demonstra`.

### Principii de management în motorul AI

- **80/20 (Pareto):** identifică task-urile cu cel mai mare impact și reduce munca cu randament mic.
- **Ivy Lee:** maximum 3 priorități reale pentru zi; lucrează-le în ordine.
- **Eisenhower:** urgent/importanță pentru triere, nu ca ecran obligatoriu zilnic.
- **SMART:** obiective specifice, măsurabile, realizabile, relevante și limitate în timp.
- **OKR:** obiective ambițioase cu key results cuantificabile.
- **GTD:** capturează ideile, clarifică următoarea acțiune, organizează după context/proiect.
- **Timeboxing:** sarcinile primesc blocuri de timp, nu doar deadline-uri.
- **WIP limits:** nu începe prea multe proiecte/task-uri simultan.
- **Critical path și dependency mapping:** pentru proiecte cu etape dependente.
- **Agile / sprinturi:** doar pentru proiecte iterative; nu forța metodologia pentru viața personală.
- **Waterfall:** doar pentru proiecte cu faze fixe, aprobări sau livrabile secvențiale.
- **Weekly review:** recalibrare a priorităților, capacității și riscurilor.

### Integrare cu Pomodoro

- AI estimează inițial task-urile în Pomodoro, apoi învață din timpii reali ai utilizatorului.
- Înainte de sesiune: sugerează o intenție, un task și un rezultat clar.
- După sesiune: cere feedback minim: `terminat`, `continuă`, `blocat`, `estimare greșită`.
- După 3–5 sesiuni, adaptează estimările și recomandă pauze/alternarea energiei.
- Nu transformă fiecare minut în metrică; respectă odihna, zilele libere și capacitatea umană.
- Pentru sprinturile de învățare, progresul arată atât timp investit, cât și dovezi de competență, nu doar numărul de ore.

### UX AI premium

- Ecran „Build my path”: utilizatorul descrie ținta în limbaj natural.
- AI răspunde cu o hartă de drum vizuală, nu cu un perete de text.
- Fiecare recomandare are: impact, estimare Pomodoro, motiv, dependențe și un CTA: `Add to this week`, `Schedule`, `Break down`, `Not now`.
- Planul AI este prezentat ca draft; utilizatorul aprobă înainte de crearea sau reprogramarea masivă de task-uri.
- Pentru acțiuni mici, utilizatorul poate activa opțional „auto-prepare”: AI poate pregăti drafturile zilnice, dar nu șterge sau mută automat date importante fără confirmare.

### Arhitectură AI sigură

- Apelează modelul doar server-side, prin Edge Function/Worker; cheia API nu ajunge în browser.
- Definește tool-uri cu scop limitat: `read_goals`, `read_projects`, `create_task_draft`, `create_plan_draft`, `schedule_draft`, `explain_recommendation`.
- Tool-urile de modificare generează preview/draft înainte de commit; userul aprobă.
- Aplică limite de rată, limită de cost per utilizator, timeout, audit trail și feedback pentru răspunsuri nereușite.
- Nu tratează AI-ul ca specialist medical, juridic sau financiar; pentru wellbeing oferă sugestii generale, nu diagnostic.
- Include teste pentru prompt injection: conținutul unui task/proiect nu poate instrui AI-ul să ignore regulile sau să divulge date.

### Exemple de fluxuri

**Obiectiv de învățare:**

`Vreau să devin frontend developer în 12 luni` → evaluare nivel → curriculum pe 4 trimestre → proiecte portofoliu → plan lunar → 3 task-uri zilnice → Pomodoro → review săptămânal.

**Obiectiv business:**

`Vreau să lansez Moneo în 6 luni` → research → MVP → billing/legal → beta → launch → milestones, riscuri, dependințe și weekly capacity.

---

---

## Faza 7 — Insight-uri care au valoare

Adaugă numai insight-uri care conduc la o acțiune:

- „Ai cele mai bune sesiuni între 09:00–11:00; blochează mâine 50 minute.”
- „Cariera a primit 4 ore, iar Sănătatea nu a primit nicio acțiune săptămâna aceasta. Alege un pas de 10 minute.”
- „Planul de azi depășește capacitatea cu 2h. Mută două task-uri în mâine.”
- „Proiectul X consumă focus fără progres spre obiectiv; schimbă următoarea sarcină.”

Fiecare insight trebuie să aibă: motiv, datele folosite, nivel de încredere și un CTA concret.

---

## Ordinea exactă recomandată

1. Faza 0: corectitudine, securitate, billing și ștergere de cont.
2. Faza 1: refactor minim + code splitting.
3. Faza 2: simplificarea parcursului Focus → Today.
4. Faza 3: Harta Vieții local-first + constructor + review.
5. Faza 4: redesign și motion, aplicate întâi pe Focus, Today și Harta Vieții.
6. Faza 5: i18n pentru cele 8 limbi.
7. Faza 5A: securitate, mentenanță și observabilitate.
8. Faza 6: AI Planning Companion cu draft-uri aprobabile.
9. Faza 7: insight-uri conectate la acțiuni.

## Definition of Done

- Nu există vulnerabilitățile React Router raportate anterior.
- Ștergerea contului este reală, verificată end-to-end și explicată corect în UI.
- Checkout-ul diferențiază corect lunar/anual și webhook-ul este testat.
- Harta Vieții este utilizabilă fără cont, accesibilă și responsive.
- UI-ul nou are motion plăcut, dar rămâne rapid și compatibil reduced-motion.
- Toate cele 8 limbi sunt complete în suprafețele noi/modificate.
- AI-ul poate transforma un obiectiv mare într-un plan anual/lunar/săptămânal/zilnic, poate estima în Pomodoro și nu modifică în masă datele fără preview/aprobare.
- Toate testele, linterul și build-ul trec.
- Nu există erori de console în fluxurile Focus, Today, Harta Vieții, Settings și Account.

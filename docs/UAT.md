# Moneo — UAT checklist (release candidate)

> Versia de testat: tag/commit ________ • Tester: ________ • Data: ________
>
> Reguli generale pentru toate testele:
>
> - Începe cu **storage curat** (DevTools → Application → Clear site data)
>   sau, pe mobil, șterge datele site-ului din setările browserului.
> - Un test pica dacă apare orice eroare în consola browserului (F12 /
>   Inspect) care nu e legată de extensii.
> - Notează browserul + versiunea și device-ul la fiecare eșec.

---

## 0. Matricea de medii

| #    | Platformă | Browser / mod         | Rezultat (OK / Fail / N-A) |
| ---- | --------- | --------------------- | -------------------------- |
| 0.1  | Windows   | Chrome (desktop)      |                            |
| 0.2  | Windows   | Firefox (desktop)     |                            |
| 0.3  | Windows   | Edge (desktop)        |                            |
| 0.4  | macOS     | Safari (desktop)      |                            |
| 0.5  | macOS     | Chrome (desktop)      |                            |
| 0.6  | Android   | Chrome (touch)        |                            |
| 0.7  | Android   | Firefox               |                            |
| 0.8  | iOS       | Safari (touch)        |                            |
| 0.9  | iOS       | Safari — PWA instalat |                            |
| 0.10 | Android   | Chrome — PWA instalat |                            |

Peste tot ce urmează, rulează minim: **Chrome desktop, Firefox desktop,
Safari desktop, Chrome Android, Safari iOS (web + PWA)**. Restul matricei
e optional, dar căsătorește regresii specifice (porecle Safari = storage).

---

## 1. Timer / Focus (fluxul principal, local-first)

| #    | Pas                                             | Rezultat așteptat                                                                                         | OK? |
| ---- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --- |
| 1.1  | Deschide homepage fără cont                     | Timerul e vizibil și funcțional; fără erori în consolă; nicăieri nu e cerut login                         |     |
| 1.2  | Tastează o intenție + Space                     | Rotunda pornește din intenție; butoanele Pause/Reset funcționează                                         |     |
| 1.3  | Alege un proiect + task din selector            | Taskul apare în rotundă; selectorul ține minte proiectul după refresh                                     |     |
| 1.4  | Setează un preset de durată (ex. 50m)           | Timerul afișează durata; preset-ul rămâne între sesiuni                                                   |     |
| 1.5  | Lasă o sesiune în desfășurare, reîncarcă pagina | Timerul **continuă de la același minut** (snapshot boot), nu o ia de la capăt                             |     |
| 1.6  | finalizează o sesiune focus                     | Apare rezumatul + **Progress Meter**: „You moved [proiect] cu X” cu minute, % task, săptămână, goal legat |     |
| 1.7  | Cu `prefers-reduced-motion` activat (OS)        | Meter-ul afișează valorile, fără animație; textul e citit de screen reader (role=status)                  |     |
| 1.8  | Sesiune fără proiect legat                      | Meter-ul nu randează nimic; restul rezumatului e intact                                                   |     |
| 1.9  | Completează ultimul task al proiectului         | Meter-ul sărbătorește **milestone 100%**                                                                  |     |
| 1.10 | Rulează 2+ sesiuni pe același proiect           | Procentul proiectului și minutele pe săptămână cresc vizibil                                              |     |
| 1.11 | Navighează între taburi (focus/today/orar/...)  | Nimic nu se deformează; fără salt de layout                                                               |     |
| 1.12 | Tastează /                                      | Deschide search-ul; Enter pe un rezultat te duce corect                                                   |     |
| 1.13 | Notifications ON (browser permite)              | Notificare la final de sesiune; dacă browserul refuză permisiunea, app-ul merge în continuare fără erori  |     |
| 1.14 | Sunetul de final (dacă e activat)               | Se aude pe desktop; pe iOS se aude doar dacă PWA e instalat și nu ai dat swipe-up (documentat, nu bug)    |     |
| 1.15 | Date/history persistence                        | După refresh, sesiunile de azi apar în StatsCard și Azi; după închiderea browserului, persistă            |     |

## 2. Onboarding & progres (criteriul „aha < 5 minute")

| #   | Pas                                                               | Rezultat așteptat                                                                                          | OK? |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --- |
| 2.1 | Storage curat, prima deschidere                                   | Onboarding-ul apare cu 3 pași: obiectiv → primul pas → start; butonul Skip disponibil                      |     |
| 2.2 | Completezi quickstart-ul                                          | Se creează proiect + task + goal; ești dus pe Focus cu taskul preselectat                                  |     |
| 2.3 | Timp de la prima deschidere până la primul Progress Meter vizibil | **Sub 5 minute**                                                                                           |     |
| 2.4 | Limba salvată în localStorage                                     | La redeschidere, app-ul pornește în limba aleasă                                                           |     |
| 2.5 | Fără preferință salvată                                           | Limba detectată din browser; dacă nu e dintre cele 8, cade pe engleză                                      |     |
| 2.6 | Schimbă limba din Settings → Language                             | Traducerile se încarcă leneș; textul vechi rămâne până se încarcă; la refresh, limba nouă e boot-implicită |     |
| 2.7 | Planificare avansată: toggle OFF (default utilizator nou)         | Kanban/Sprints/Gantt/Waterfall ascunse în spatele unui singur toggle                                       |     |
| 2.8 | Toggle ON apoi OFF                                                | Alegerea persistă după refresh; cu date agile existente (sprints/faze), default ON                         |     |

## 3. Sync (Supabase) — opțional și consimțit

| #    | Pas                                                                                        | Rezultat așteptat                                                                                                  | OK? |
| ---- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | --- |
| 3.1  | Semn-up email + parolă (staging: verify email oprit)                                       | Contul se creează; ești autentificat; header-ul afișează emailul                                                   |     |
| 3.2  | Fără sync activat                                                                          | Nimic nu se upload-uiește; proiectele/task-urile rămân locale                                                      |     |
| 3.3  | Deschide cont → Sync panel → „Sync now" (consimțământ)                                     | Prima sincronizare duce **doar** sesiunile, zonele de focus și settings; proiectele/task-urile NU urcă             |     |
| 3.4  | Rulează 1 sesiune, așteaptă / redeschide                                                   | Sesiunea apare pe alt device (același cont) după sync                                                              |     |
| 3.5  | Editează settings pe 2 device-uri, apoi sync                                               | Câștigă cel mai nou (last-write-wins pe câmp); fără duplicate                                                      |     |
| 3.6  | Conectat la aceleași zone pe 2 device-uri, creează zone pe amândouă, sync                  | Fără pierdere de sesiuni; id-urile locale se păstrează, cele cloud se adoptă; conflictele nu produc erori vizibile |     |
| 3.7  | Oprește network → rulează sesiuni → repornește network → sync                              | Sesiunile se împing la loc; fără duplicate în cloud                                                                |     |
| 3.8  | Sync eșuat (ex. revocă token)                                                              | Mesaj clar „Sync failed — local data safe"; datele locale rămân intacte; retry funcționează                        |     |
| 3.9  | Logout                                                                                     | Datele locale rămân; sync-ul se oprește; la relogin, starea sync se reia corect                                    |     |
| 3.10 | Clear History (buton Stats) cu sync ON                                                     | Butonul e blocat / dezactivat — history protejat de sync activ                                                     |     |
| 3.11 | RLS: cu tokenul unui cont, încearcă citirea sesiunilor altui cont (SQL editor, direct API) | Returnează zero rânduri — RLS ține                                                                                 |     |

## 4. Checkout / Billing (Lemon Squeezy, cont de test staging)

| #    | Pas                                                                | Rezultat așteptat                                                                                                                               | OK? |
| ---- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 4.1  | Pagini /pricing                                                    | Prețurile afișate sunt identice cu tabelul Free vs Pro din pagina de checkout (9 EUR / 90 EUR / an); zero discrepanțe                           |     |
| 4.2  | Utilizator Free apasă Upgrade                                      | Checkout LS se deschide (varianta corectă, monthly vs yearly); user_id e atașat                                                                 |     |
| 4.3  | Plată test cu card de succes                                       | Webhook-ul procesează evenimentul; la refresh, Pro e activat fără acțiune manuală                                                               |     |
| 4.4  | După upgrade                                                       | Toate gating-urile Pro se deblochează: CSV export, PDF report, project limit, sync scope; fără relogin                                          |     |
| 4.5  | Webhook duplicat (trimite același event de 2x din LS dashboard)    | Idempotent — starea nu se corupe, fără erori                                                                                                    |     |
| 4.6  | Semnătură greșită la webhook                                       | Endpoint-ul respinge (4xx); statusul abonamentului rămâne                                                                                       |     |
| 4.7  | Downgrade/cancel din Customer Portal (buton „Manage subscription") | Portalul se deschide pe link real https; după cancel, la expirare Pro se retrage                                                                |     |
| 4.8  | Free user încearcă direct export CSV (consolă/fără gating UI)      | Gating-ul server-side nu există, dar clientul afișează upsell-ul și nu exportă; nu se poate obține Pro fără plată (verificat cu tooling de dev) |     |
| 4.9  | Checkout cu date invalide/card respins                             | Fără creditare; mesaj de eroare de la LS, app-ul nu se blochează                                                                                |     |
| 4.10 | iOS Safari / Android                                               | Checkout-ul se deschide tab nou, revii în app fără pierderea sesiunii de focus în desfășurare (timerul continuă cu snapshot la revenire)        |     |

## 5. Delete account (GDPR)

| #   | Pas                                                                                                 | Rezultat așteptat                                                                                                          | OK? |
| --- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --- |
| 5.1 | Cont cu date sincronizate (sesiuni, zone, settings) + abonament activ → Delete account (confirmare) | Dialog cu două confirmații; la final, signed out și header-ul revine la „Sync"                                             |     |
| 5.2 | În Supabase dashboard (SQL)                                                                         | Rândul din `auth.users` dispărut; rândurile din sesiuni/zone/settings/abonamente (tables 0001-0005) dispărute prin cascade |     |
| 5.3 | Token-ul vechi după ștergere                                                                        | Nu mai poate citi nimic (RLS + auth) — testează cu `Authorization: Bearer <token>` pe REST API                             |     |
| 5.4 | Date locale                                                                                         | Rămân pe device (delete account e cloud-only — confirmă explicit la tester)                                                |     |
| 5.5 | Re-signup cu același email                                                                          | Cont nou curat, fără reste din vechi                                                                                       |     |
| 5.6 | Utilizator anonime care încearcă endpoint-ul de delete fără token                                   | 401, fără efecte secundare                                                                                                 |     |

## 6. PWA / offline

| #   | Pas                                                                  | Rezultat așteptat                                                                    | OK? |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --- |
| 6.1 | Prompt de instalare (Chrome desktop/Android; iOS Add to Home Screen) | Se instalează; iconițele și numele corecte                                           |     |
| 6.2 | Deschide app instalat **fără internet**                              | Shell-ul se încarcă din service worker; timerul funcționează offline                 |     |
| 6.3 | Rulează sesiuni offline, apoi reconectează                           | Datele persistă; sync (dacă e activ) le împinge                                      |     |
| 6.4 | Publică un build nou (staging) → redeschide app instalat             | autoUpdate: la reload/swipe, versiunea nouă e activă (verifică `sw.js` vechi vs nou) |     |
| 6.5 | Manifest valid (Lighthouse PWA)                                      | Fără erori de manifest / theme-color / display                                       |     |
| 6.6 | Shortcut „Start Focus" din app launcher                              | Deschide direct pe Focus                                                             |     |

## 7. Cross-cutting / regresiuni rapide

| #   | Verificare                                                                                                      | OK? |
| --- | --------------------------------------------------------------------------------------------------------------- | --- |
| 7.1 | Consolă fără erori în toate fluxurile de mai sus                                                                |     |
| 7.2 | Tab-ul Reports: Weekly Recap randat; Share/Download produce PNG valid (pe iOS, share fallback = download)       |     |
| 7.3 | Export CSV (Pro) — fișierul se descarcă și e lizibil în Excel                                                   |     |
| 7.4 | Print/PDF report (Pro) pe Chrome + Safari — header/footer corecte                                               |     |
| 7.5 | Keyboard-only: tot fluxul de focus accesibil (Tab/Enter/Space), focus vizibil                                   |     |
| 7.6 | Screen reader (VoiceOver/NVDA) pe Progress Meter și pe onboarding — text complet citit                          |     |
| 7.7 | Performanță: Lighthouse ≥ 90 PWA; primul load pe 4G sub ~3s; main chunk sub 250 kB gzip (CI)                    |     |
| 7.8 | Date locale nu pleacă nicăieri: verifică Network tab — la sesiune fără cont, zero requesturi cu payload de user |     |

## 8. Semnătură de release

- [ ] Toate secțiunile 1-7 trecute pe minimul de combinații din secțiunea 0
- [ ] Bug-urile open sunt triate: blocker (0), major (≤ 2, documentate)
- [ ] Migrările 0001-0005 rulate pe **staging** și verificate (job-ul `Supabase migrations` cu `dry_run=false`), apoi pe **production** cu aprobare
- [ ] DNS check verde după ultimul deploy (workflow `DNS + edge health`)
- [ ] Rollback plan gata: tag-ul versiunii precedente + comanda de redeploy

Release: ________ • Aprobat de: ________ • Data: ________

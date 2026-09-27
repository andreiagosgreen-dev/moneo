import { PRO_PRICES } from '../../billing/pricingConfig';
import { MERCHANT_OF_RECORD, REFUND_DAYS, SELLER, SITE_URL, formatLegalDate } from '../seller';
import type { LegalSet } from '../types';

const OPERATOR = `${SELLER.name}, ${SELLER.entity.ro} cu sediul în ${SELLER.country.ro}`;
const UPDATED = `Ultima actualizare: ${formatLegalDate('ro')}`;
const MOR = MERCHANT_OF_RECORD;

/** Romanian translation. The English version (en.ts) is the legally binding one. */
export const legalRo: LegalSet = {
  terms: {
    title: 'Termeni și condiții',
    updated: UPDATED,
    intro: [
      `Acești Termeni și condiții („Termenii”) reglementează folosirea Moneo, cronometrul de concentrare și planificatorul disponibil la ${SITE_URL} și ca aplicație web instalabilă („Serviciul”). Te rugăm să-i citești împreună cu {privacy} și cu {refund}.`,
    ],
    sections: [
      {
        heading: '1. Cine operează Moneo',
        blocks: [`Moneo este operat de ${OPERATOR} („noi”). Ne poți scrie la {email}.`],
      },
      {
        heading: '2. Acceptarea Termenilor',
        blocks: [
          'Folosind Serviciul sau creând un cont, accepți acești Termeni. Dacă nu ești de acord, te rugăm să nu folosești Serviciul.',
          'Pentru a crea un cont trebuie să ai cel puțin 16 ani sau acordul unui părinte ori al unui tutore legal.',
        ],
      },
      {
        heading: '3. Serviciul',
        blocks: [
          'Moneo te ajută să-ți planifici ziua și să lucrezi în sesiuni de concentrare. Funcționează „local întâi”: majoritatea funcțiilor merg fără cont, iar datele tale sunt salvate în browser, pe dispozitivul tău.',
          'Cu un cont Pro poți sincroniza în baza noastră de date din cloud sesiunile de concentrare, ariile de focus și setările. Proiectele, sarcinile, planurile, obiectivele, obiceiurile, jurnalul și celelalte date de planificare rămân pe dispozitivul tău.',
        ],
      },
      {
        heading: '4. Contul tău',
        blocks: [
          'Te poți înregistra cu o adresă de email și o parolă sau cu Google. Te rugăm să folosești o adresă de email validă, să-ți păstrezi parola în siguranță și să ne anunți la {email} dacă bănuiești că altcineva ți-a accesat contul. Ești responsabil pentru activitatea din contul tău.',
          'Îți poți șterge contul oricând din pagina Cont („Șterge contul”).',
        ],
      },
      {
        heading: '5. Planurile Free și Pro',
        blocks: [
          'Planul Free nu are limită de timp. Include cronometrul de concentrare și un număr limitat de proiecte, obiective, obiceiuri și alte elemente. Putem ajusta limitele Free pe viitor; nu vom șterge date deja create din cauza unei schimbări de limită.',
          `Pro este un abonament plătit: ${PRO_PRICES.monthly} pe lună sau ${PRO_PRICES.yearly} pe an. În funcție de țara ta, la plată se pot adăuga taxe precum TVA. Lista actuală a funcțiilor Pro este pe pagina de prețuri.`,
        ],
      },
      {
        heading: `6. Plata prin ${MOR}`,
        blocks: [
          `Abonamentele Pro sunt vândute de ${MOR}, revânzătorul nostru și „Merchant of Record” (comerciantul înregistrat). ${MOR} procesează plata, încasează și virează taxele aplicabile, emite chitanțele și facturile și procesează rambursările. Când cumperi Pro, accepți și termenii ${MOR} pentru cumpărători, care se aplică achiziției propriu-zise.`,
          'Nu vedem și nu stocăm niciodată datele complete ale cardului tău. Primim doar informațiile necesare pentru a lega abonamentul de contul tău Moneo (de exemplu starea abonamentului, planul și data reînnoirii).',
        ],
      },
      {
        heading: '7. Reînnoirea automată și anularea',
        blocks: [
          'Abonamentele se reînnoiesc automat la sfârșitul fiecărei perioade de facturare (lunar sau anual) și se plătesc cu metoda ta de plată până le anulezi.',
          'Poți anula oricând din portalul clientului (Cont → Gestionează abonamentul) sau scriindu-ne la {email}. Anularea oprește reînnoirile viitoare; păstrezi Pro până la sfârșitul perioadei deja plătite, apoi contul revine la Free.',
          'Dacă schimbăm prețul Pro, te anunțăm din timp. Noul preț se aplică doar de la următoarea reînnoire, iar tu poți anula înainte să intre în vigoare.',
        ],
      },
      {
        heading: '8. Rambursări',
        blocks: [
          `Poți primi banii înapoi integral în ${REFUND_DAYS} zile de la o plată, fără întrebări. Detaliile și modul de solicitare sunt în {refund}.`,
        ],
      },
      {
        heading: '9. Folosire acceptabilă',
        blocks: [
          'Ești de acord să nu:',
          {
            list: [
              'încalci legea sau drepturile altora folosind Serviciul;',
              'încerci să accesezi datele altor utilizatori sau să scanezi ori să ataci sistemele noastre;',
              'ocolești limitele planurilor, plățile sau măsurile de securitate ori să revinzi Serviciul;',
              'suprasoliciți Serviciul cu cereri automate sau să-l folosești pentru spam ori programe malițioase.',
            ],
          },
        ],
      },
      {
        heading: '10. Conținutul tău',
        blocks: [
          'Tot ce creezi în Moneo îți aparține: sesiuni, sarcini, notițe și alte date. Nu revendicăm niciun drept de proprietate asupra lor.',
          'Ne dai doar permisiunea limitată de a-ți stoca, sincroniza și afișa conținutul, ca să putem furniza Serviciul. Nu vindem datele tale și nu le folosim pentru reclame.',
        ],
      },
      {
        heading: '11. Funcțiile AI',
        blocks: [
          'Unele funcții sugerează planuri, pași sau răspunsuri. Pot folosi reguli locale sau un model AI. Rezultatele AI pot fi greșite, incomplete sau depășite. Nu sunt sfaturi profesionale (medicale, juridice, financiare sau de alt fel). Verifică sugestiile înainte să te bazezi pe ele.',
          'Utilizatorii Pro își pot conecta propria cheie API pentru un furnizor AI (de exemplu Google Gemini, OpenAI sau DeepSeek). Cheia ta e salvată doar în browser. Cererile merg direct din browserul tău la acel furnizor, în baza acordului tău cu el. Tu răspunzi de cheie, de costurile percepute de furnizor și de respectarea termenilor lui. Evită să trimiți date personale sensibile către funcțiile AI.',
        ],
      },
      {
        heading: '12. Servicii terțe',
        blocks: [
          'Integrările opționale, cum ar fi autentificarea cu Google sau Google Calendar, sunt oferite de terți, în baza propriilor termeni. Nu răspundem pentru servicii pe care nu le controlăm.',
        ],
      },
      {
        heading: '13. Disponibilitatea și schimbările Serviciului',
        blocks: [
          'Ne străduim să menținem Moneo disponibil și datele tale în siguranță, dar nu putem promite că Serviciul va funcționa mereu fără întreruperi sau erori. Pentru că datele sunt salvate întâi pe dispozitiv, ștergerea datelor din browser le poate șterge. Păstrează-ți propriile copii (de exemplu cu exportul Pro) pentru tot ce e important.',
          'Putem adăuga, modifica sau elimina funcții. Dacă renunțăm complet la Pro, îți rambursăm partea nefolosită din orice abonament plătit în avans.',
        ],
      },
      {
        heading: '14. Fără garanții',
        blocks: [
          'În măsura permisă de lege, Serviciul este oferit „ca atare” și „după disponibilitate”, fără garanții de niciun fel, explicite sau implicite, inclusiv privind potrivirea pentru un anumit scop. Nimic din acești Termeni nu îți limitează drepturile de consumator prevăzute de legea imperativă.',
        ],
      },
      {
        heading: '15. Limitarea răspunderii',
        blocks: [
          'În măsura permisă de lege, nu răspundem pentru pierderi indirecte, cum ar fi profitul pierdut, datele pierdute sau oportunitățile ratate. Răspunderea noastră totală pentru orice pretenție legată de Serviciu este limitată la suma plătită de tine pentru Moneo în cele 12 luni dinaintea pretenției.',
          'Aceste limite nu se aplică răspunderii care nu poate fi limitată prin lege, cum ar fi răspunderea pentru fapte intenționate, culpă gravă sau vătămare corporală ori deces cauzate din neglijență.',
        ],
      },
      {
        heading: '16. Încetarea',
        blocks: [
          'Poți înceta oricând să folosești Moneo și îți poți șterge contul din pagina Cont.',
          'Putem suspenda sau închide un cont care încalcă grav ori repetat acești Termeni sau când legea o cere. Când e rezonabil, te avertizăm întâi și îți dăm ocazia să-ți exporți datele. Dacă îți închidem contul fără ca tu să fi încălcat Termenii, îți rambursăm partea nefolosită din orice abonament plătit în avans.',
        ],
      },
      {
        heading: '17. Modificarea Termenilor',
        blocks: [
          'Putem actualiza acești Termeni. Dacă o schimbare e importantă, te anunțăm în aplicație sau pe email înainte să intre în vigoare. Data „Ultima actualizare” de mai sus arată versiunea curentă. Dacă folosești Serviciul în continuare după intrarea în vigoare a schimbării, se aplică noii Termeni; dacă nu ești de acord, poți anula abonamentul și șterge contul.',
        ],
      },
      {
        heading: '18. Legea aplicabilă',
        blocks: [
          `Acești Termeni sunt guvernați de legile din ${SELLER.country.ro}, iar litigiile sunt soluționate de instanțele competente de acolo.`,
          'Dacă ești consumator cu reședința în Uniunea Europeană sau în Spațiul Economic European, păstrezi și protecția legilor imperative de protecție a consumatorului din țara ta și poți acționa în instanțele din țara ta.',
        ],
      },
      {
        heading: '19. Contact',
        blocks: [`Întrebări despre acești Termeni? Scrie-i lui ${SELLER.name} la {email}.`],
      },
    ],
  },

  privacy: {
    title: 'Politica de confidențialitate',
    updated: UPDATED,
    intro: [
      'Această politică explică ce date personale prelucrează Moneo, de ce, cine ne ajută să le prelucrăm și ce opțiuni și drepturi ai. Moneo funcționează „local întâi”: implicit, datele tale rămân în browser, pe dispozitivul tău.',
    ],
    sections: [
      {
        heading: '1. Cine răspunde de datele tale',
        blocks: [`Operatorul de date este ${OPERATOR}. Contact: {email}.`],
      },
      {
        heading: '2. Date care rămân pe dispozitivul tău',
        blocks: [
          'Tot ce creezi e salvat întâi în stocarea locală a browserului, pe dispozitivul tău: sesiuni de concentrare, arii de focus, setări, proiecte, sarcini, planuri zilnice, blocuri de timp, obiective, OKR-uri, abilități, obiceiuri, jurnal și energie, istoricul discuțiilor cu asistentul și date similare. Noi nu putem vedea aceste date. Ele rămân pe dispozitiv, cu excepția sincronizării în cloud din Pro (vezi mai jos).',
          'Dacă adaugi propria cheie API pentru un furnizor AI, și ea e salvată doar în browser. Nu este trimisă niciodată către serverele Moneo.',
        ],
      },
      {
        heading: '3. Datele pe care le prelucrăm',
        blocks: [
          {
            list: [
              'Contul: adresa de email, parola în formă criptată ireversibil (hash, dacă folosești parolă), metoda de autentificare și datele contului, gestionate de furnizorul nostru de autentificare. Dacă intri cu Google, primim de la Google adresa de email și datele de profil de bază.',
              'Profilul: fusul orar, folosit ca să-ți numărăm corect zilele.',
              'Sincronizarea în cloud (doar Pro): sesiunile de concentrare (durata, ora, intenția scrisă, aria de focus), ariile de focus, setările și un identificator aleator al dispozitivului, folosit la combinarea modificărilor între dispozitive.',
              'Abonamentul: planul, starea, data reînnoirii și ID-urile de client și de abonament Lemon Squeezy, primite de la Lemon Squeezy ca să știm dacă ai Pro.',
              'Partenerul de focus (opțional, Pro): dacă te asociezi cu un partener, un cod de invitație și asocierea; partenerul vede doar minutele tale de concentrare de azi.',
              'Google Calendar (opțional, Pro): dacă îl conectezi, un token care ne permite să citim evenimentele din calendar (doar citire), ca să arătăm suprapunerile cu planul tău. Evenimentele sunt citite la nevoie și nu le stocăm. Poți deconecta oricând.',
              'Rapoarte de eroare: dacă aplicația se blochează, un mesaj tehnic de eroare și traseul erorii (stack trace). Rapoartele nu sunt legate de contul tău și nu sunt menite să conțină conținutul tău.',
              'Date de securitate: adresa IP și datele cererii, prelucrate pe scurt de furnizorul de găzduire și de protecția anti-bot de pe formularul de autentificare, ca să protejăm Serviciul de abuz.',
              'Mesajele pe care ni le trimiți: adresa ta de email și conținutul mesajului.',
            ],
          },
          'Datele de facturare (nume, adresă de facturare, datele cardului) sunt colectate și păstrate de Lemon Squeezy, ca Merchant of Record, nu de Moneo.',
        ],
      },
      {
        heading: '4. Funcțiile AI',
        blocks: [
          'Implicit, planurile de tip AI sunt construite pe dispozitivul tău, cu reguli simple, și nu se trimite nimic nicăieri.',
          'Dacă ai Pro și adaugi propria cheie API pentru Google Gemini, OpenAI sau DeepSeek, obiectivul scris de tine și detaliile de planificare (orizontul de timp, orele pe săptămână, nivelul) sunt trimise direct din browserul tău la acel furnizor. Furnizorul le prelucrează conform propriei politici de confidențialitate, ca furnizor al tău, nu al nostru.',
          'Dacă activăm un planificator AI pe server, prin serverul nostru ajung la furnizorul AI doar textul obiectivului (maximum 500 de caractere), orizontul de timp și orele pe săptămână. Nu se includ sesiuni, sarcini sau date ale contului.',
          'Dictarea vocală din asistent folosește recunoașterea vocală integrată în browser. Unele browsere (de exemplu Chrome) trimit sunetul către serverele producătorului browserului ca să-l transcrie.',
        ],
      },
      {
        heading: '5. De ce folosim datele (temeiuri legale)',
        blocks: [
          'Prelucrăm datele personale conform Regulamentului general privind protecția datelor (GDPR) pentru utilizatorii din UE/SEE și conform Legii Republicii Moldova nr. 133/2011 privind protecția datelor cu caracter personal (sau oricărei legi care o înlocuiește).',
          {
            list: [
              'Ca să-ți oferim Serviciul cerut — cont, sincronizare, funcții Pro și starea abonamentului (executarea unui contract).',
              'Ca să menținem Serviciul sigur și funcțional — protecție anti-bot, limitarea cererilor și rapoarte de eroare (interesul nostru legitim pentru o aplicație sigură și fiabilă).',
              'Pentru funcțiile opționale pe care le activezi — Google Calendar, partenerul de focus, propria cheie AI (consimțământul tău, pe care îl poți retrage oricând dezactivând funcția).',
              'Ca să respectăm obligațiile legale, de exemplu păstrarea unor evidențe când legea o cere.',
            ],
          },
        ],
      },
      {
        heading: '6. Furnizori de servicii (persoane împuternicite)',
        blocks: [
          'Folosim acești furnizori ca să funcționeze Moneo. Ei prelucrează datele doar la instrucțiunile noastre sau, unde e menționat, ca operatori independenți:',
          {
            list: [
              'Supabase — autentificare și bază de date în cloud (găzduită în UE, Irlanda). Trimite și emailurile de autentificare, confirmare și resetare a parolei, direct sau printr-un furnizor de livrare email configurat de noi.',
              'Cloudflare — găzduire, livrare de conținut, securitate și protecția anti-bot Turnstile pe formularele de autentificare (rețea globală).',
              'Lemon Squeezy — checkout, plăți, taxe, facturi și rambursări, ca Merchant of Record (operator independent pentru datele de facturare; SUA).',
              'Google — autentificarea cu Google și, dacă îl conectezi, Google Calendar (SUA).',
              'Sentry (Functional Software, Inc.) — rapoarte de eroare (date stocate în UE, Germania).',
              'GitHub (Microsoft) — păstrează copiile de siguranță săptămânale, criptate, ale bazei de date (SUA).',
              'Furnizorii AI aleși chiar de tine (Google Gemini, OpenAI, DeepSeek) — doar dacă adaugi propria cheie; și, dacă activăm planificarea AI pe server, furnizorul AI configurat pe serverul nostru.',
            ],
          },
          'Nu vindem datele tale personale și nu le împărtășim cu agenți de publicitate sau brokeri de date.',
        ],
      },
      {
        heading: '7. Transferuri internaționale',
        blocks: [
          'Unii furnizori se află în afara țării tale, inclusiv în Statele Unite și, pentru DeepSeek dacă îl alegi, în China. Unde se aplică GDPR, transferurile se bazează pe decizii de adecvare (cum ar fi Cadrul UE–SUA privind protecția datelor, pentru furnizorii certificați) sau pe Clauzele contractuale standard ale Comisiei Europene.',
        ],
      },
      {
        heading: '8. Cât timp păstrăm datele',
        blocks: [
          {
            list: [
              'Datele de pe dispozitiv: până le ștergi tu sau ștergi datele browserului.',
              'Datele contului și din cloud: până îți ștergi contul. Ștergerea le elimină imediat din baza de date activă; copiile din backup-urile criptate expiră în cel mult 30 de zile.',
              'Rapoartele de eroare: până la 90 de zile.',
              'Jurnalele de securitate la furnizorul de găzduire: perioade scurte, de obicei câteva zile.',
              'Emailurile către suport: cât e nevoie ca să rezolvăm cererea, dar cel mult 2 ani.',
              'Evidențele de facturare: păstrate de Lemon Squeezy cât cer legile fiscale și contabile.',
            ],
          },
        ],
      },
      {
        heading: '9. Drepturile și opțiunile tale',
        blocks: [
          'Ai dreptul să-ți accesezi, corectezi, exporți sau ștergi datele personale, să te opui anumitor prelucrări sau să ceri restricționarea lor, să-ți retragi oricând consimțământul și dreptul la portabilitatea datelor.',
          {
            list: [
              'Ștergerea datelor de pe dispozitiv: Setări → „Șterge toate datele de pe acest dispozitiv”.',
              'Ștergerea contului și a datelor din cloud: Cont → „Șterge contul”. Dacă ai un abonament activ, anulează-l întâi din portalul clientului.',
              'Export: utilizatorii Pro pot exporta sesiunile în CSV/PDF. Pentru orice altă cerere, scrie-ne la {email}.',
              'Oprești sincronizarea în cloud deconectându-te; datele rămân pe dispozitivul tău.',
            ],
          },
          'Răspundem la cereri în cel mult o lună. Poți depune și o plângere la o autoritate de protecție a datelor: în Republica Moldova, Centrul Național pentru Protecția Datelor cu Caracter Personal; în UE/SEE, autoritatea din țara ta de reședință.',
        ],
      },
      {
        heading: '10. Cookie-uri și stocare locală',
        blocks: [
          'Moneo nu folosește cookie-uri de publicitate, analytics sau pixeli de urmărire. Folosim stocarea locală a browserului ca să salvăm datele tale și sesiunea de autentificare, lucru strict necesar pentru funcționarea aplicației. Cloudflare și Turnstile pot seta cookie-uri de securitate strict necesare, ca să deosebească oamenii de boți. Checkout-ul Lemon Squeezy, care se deschide pe site-ul Lemon Squeezy, folosește propriile cookie-uri.',
          'Fonturile sunt servite de pe domeniul nostru; nu încărcăm Google Fonts sau alte instrumente de urmărire ale terților.',
        ],
      },
      {
        heading: '11. Securitate',
        blocks: [
          'Datele circulă prin conexiuni criptate (HTTPS/TLS). Datele din cloud sunt protejate prin reguli de acces, astfel încât doar contul tău le poate citi, iar backup-urile bazei de date sunt criptate. Moneo nu oferă criptare end-to-end și niciun sistem nu e sigur 100%, așa că folosește o parolă puternică și unică.',
        ],
      },
      {
        heading: '12. Copii',
        blocks: [
          'Moneo nu se adresează copiilor sub 16 ani și nu colectăm cu bună știință datele lor personale. Dacă crezi că un copil ne-a dat date personale, scrie-ne și le ștergem.',
        ],
      },
      {
        heading: '13. Modificarea acestei politici',
        blocks: [
          'Putem actualiza această politică. Dacă o schimbare e importantă, te anunțăm în aplicație sau pe email. Data „Ultima actualizare” de mai sus arată versiunea curentă.',
        ],
      },
      {
        heading: '14. Contact',
        blocks: [
          `Pentru întrebări sau cereri legate de confidențialitate, scrie-i lui ${SELLER.name} la {email}.`,
        ],
      },
    ],
  },

  refund: {
    title: 'Politica de rambursare',
    updated: UPDATED,
    intro: [
      `Vrem să fii mulțumit de Moneo Pro. Dacă nu ești, îți poți primi banii înapoi în ${REFUND_DAYS} zile — fără întrebări.`,
    ],
    sections: [
      {
        heading: `1. Garanția de rambursare în ${REFUND_DAYS} zile`,
        blocks: [
          `Poți cere rambursarea integrală a oricărei plăți Pro — prima achiziție sau o reînnoire, lunară sau anuală — în ${REFUND_DAYS} zile de la data plății. Nu trebuie să ne spui motivul.`,
        ],
      },
      {
        heading: '2. Cum ceri rambursarea',
        blocks: [
          {
            list: [
              'Scrie-ne la {email} de pe adresa folosită la plată sau include adresa respectivă și numărul comenzii (îl găsești în emailul-chitanță de la Lemon Squeezy).',
              'Sau găsește comanda în emailul-chitanță de la Lemon Squeezy ori la {orders} și cere rambursarea de acolo.',
            ],
          },
        ],
      },
      {
        heading: '3. Cine procesează rambursarea',
        blocks: [
          `Plățile sunt gestionate de ${MOR}, comerciantul nostru înregistrat (Merchant of Record). După ce aprobăm cererea, ${MOR} îți returnează banii pe metoda de plată inițială, inclusiv taxele plătite. De obicei, banii apar în 5–10 zile lucrătoare, în funcție de bancă sau de emitentul cardului.`,
        ],
      },
      {
        heading: '4. Ce se întâmplă cu Pro după rambursare',
        blocks: [
          'Rambursarea anulează și abonamentul, deci nu vei mai fi taxat. Funcțiile Pro se opresc când rambursarea e procesată, iar contul revine la planul Free.',
          'Datele tale nu se șterg: tot ce e pe dispozitiv rămâne acolo, iar datele deja sincronizate rămân în cont până îl ștergi. Sincronizarea în cloud e o funcție Pro, deci se oprește.',
        ],
      },
      {
        heading: '5. Anularea nu e același lucru cu rambursarea',
        blocks: [
          {
            list: [
              'Anulare: oprește reînnoirile viitoare. Păstrezi Pro până la sfârșitul perioadei deja plătite. Nu se returnează bani. Poți anula oricând din portalul clientului (Cont → Gestionează abonamentul).',
              `Rambursare: îți returnează banii pentru o plată făcută în ultimele ${REFUND_DAYS} zile și oprește Pro imediat.`,
            ],
          },
        ],
      },
      {
        heading: `6. După ${REFUND_DAYS} zile`,
        blocks: [
          `După ${REFUND_DAYS} zile plățile, de regulă, nu se mai rambursează, dar poți anula oricând ca să oprești plățile viitoare. Corectăm întotdeauna greșelile de facturare, cum ar fi o plată dublă, și rambursăm când legea o cere. Dacă renunțăm la Pro, rambursăm partea nefolosită din orice perioadă plătită în avans.`,
          `Această politică nu îți limitează drepturile prevăzute de legea imperativă de protecție a consumatorului, inclusiv dreptul de retragere din UE, pe care garanția de ${REFUND_DAYS} zile îl acoperă deja.`,
        ],
      },
      {
        heading: '7. Contact',
        blocks: [
          'Întrebări despre facturare sau rambursări? Scrie-ne la {email}. Vezi și {terms}.',
        ],
      },
    ],
  },
};

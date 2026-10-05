import { PRO_PRICES } from '../../billing/pricingConfig';
import { DISCOUNT_CODE_VALID_DAYS } from '../../billing/rankDiscount';
import {
  ADULT_AGE,
  DIGITAL_CONSENT_AGE,
  MERCHANT_OF_RECORD,
  MIN_ACCOUNT_AGE,
  REFUND_DAYS,
  SELLER,
  SITE_URL,
  formatLegalDate,
} from '../seller';
import type { LegalSet } from '../types';

const OPERATOR = `${SELLER.name}, ${SELLER.entity.it} con sede nella ${SELLER.country.it}`;
const UPDATED = `Ultimo aggiornamento: ${formatLegalDate('it')}`;
const MOR = MERCHANT_OF_RECORD;

/** Italian translation. The English version (en.ts) is the legally binding one. */
export const legalIt: LegalSet = {
  terms: {
    title: 'Termini di servizio',
    updated: UPDATED,
    intro: [
      `I presenti Termini di servizio (i «Termini») regolano l’uso di Moneo, il timer di concentrazione e pianificatore disponibile su ${SITE_URL} e come web app installabile (il «Servizio»). Leggili insieme alla nostra {privacy} e alla nostra {refund}.`,
    ],
    sections: [
      {
        heading: '1. Chi gestisce Moneo',
        blocks: [`Moneo è gestito da ${OPERATOR} («noi»). Puoi contattarci a {email}.`],
      },
      {
        heading: '2. Accettazione dei Termini e chi può usare Moneo',
        blocks: [
          'Usando il Servizio o creando un account, accetti i presenti Termini. Se non sei d’accordo, non usare il Servizio.',
          'Moneo è pensato per alunni, studenti universitari e adulti. Puoi usarlo senza account: in questo caso i tuoi dati restano sul tuo dispositivo e non ci viene inviato nulla. È l’opzione più sicura per gli utenti più giovani.',
          {
            list: [
              `Per creare un account devi avere almeno ${MIN_ACCOUNT_AGE} anni.`,
              `Se hai meno di ${ADULT_AGE} anni, puoi usare Moneo solo con il permesso di un genitore o di un tutore legale.`,
              `Se hai meno dell’età del consenso digitale del tuo Paese (${DIGITAL_CONSENT_AGE} anni in molti Paesi dell’UE), un genitore o un tutore legale deve acconsentire prima che tu crei un account.`,
              `Un abbonamento Pro per una persona con meno di ${ADULT_AGE} anni deve essere acquistato da un genitore o da un tutore legale, oppure con il suo permesso.`,
            ],
          },
          'Il genitore o tutore legale che consente a un minore di usare Moneo accetta i presenti Termini per suo conto ed è responsabile della supervisione di tale uso. La capacità di un minore di concludere accordi è regolata dalla legge applicabile.',
        ],
      },
      {
        heading: '3. Il Servizio',
        blocks: [
          'Moneo ti aiuta a pianificare la giornata e a fare sessioni di concentrazione. Funziona in modalità «local-first»: la maggior parte delle funzioni è disponibile senza account e i tuoi dati sono salvati nel browser, sul tuo dispositivo.',
          'Con un account puoi sincronizzare sessioni di concentrazione, aree di concentrazione e impostazioni con il nostro database cloud. Con Pro, anche gli altri tuoi dati di pianificazione (progetti, attività, piani, obiettivi, abitudini, voci del diario e simili) vengono salvati nell’account e sincronizzati tra i tuoi dispositivi. Con il piano gratuito, questi dati restano sul tuo dispositivo.',
          'Aiuto, non risultati: Moneo è uno strumento che ti aiuta a organizzare tempo, piani, abitudini e obiettivi. Noi forniamo gli strumenti e i suggerimenti; ciò che ottieni dipende da te. Non promettiamo alcun risultato particolare — ad esempio voti migliori, il superamento di un esame, un lavoro, entrate più alte, perdita di peso o un certo livello di produttività.',
          'Salute ed esercizio: Movimento, la libreria di esercizi e i programmi di allenamento sono informazioni generali, non consigli medici, di fisioterapia o di nutrizione, e non sostituiscono un medico o un allenatore qualificato. Parla con un medico prima di iniziare un nuovo programma di esercizi, soprattutto se hai una patologia, un infortunio o sei incinta. Fermati se senti dolore, vertigini o mancanza di fiato. Ti alleni a tuo rischio e non promettiamo alcun risultato particolare.',
        ],
      },
      {
        heading: '4. Il tuo account',
        blocks: [
          'Puoi registrarti con indirizzo e-mail e password oppure con Google. Indica un indirizzo valido, conserva la password al sicuro e avvisaci a {email} se pensi che qualcun altro abbia avuto accesso al tuo account. Sei responsabile dell’attività svolta con il tuo account.',
          'Puoi eliminare il tuo account in qualsiasi momento dalla pagina Account («Elimina account»).',
        ],
      },
      {
        heading: '5. Piani gratuito e Pro',
        blocks: [
          'Il piano gratuito non ha limiti di tempo. Include il timer di concentrazione e un numero limitato di progetti, obiettivi, abitudini e altri elementi. Potremmo modificare in futuro i limiti del piano gratuito; non elimineremo i dati che hai già creato a causa di un cambio di limite.',
          `Pro è un abbonamento a pagamento: ${PRO_PRICES.monthly} al mese o ${PRO_PRICES.yearly} all’anno. A seconda di dove vivi, al pagamento possono aggiungersi imposte come l’IVA. L’elenco aggiornato delle funzioni Pro è riportato nella pagina dei prezzi.`,
          'Prova gratuita: quando nella pagina dei prezzi è offerta una prova, è disponibile una sola volta per ogni account che non ha mai avuto un abbonamento. Se annulli prima della fine della prova non ti viene addebitato nulla; altrimenti l’abbonamento inizia e si rinnova al prezzo indicato.',
          `Sconti di grado: quando un account senza Pro raggiunge determinati gradi XP, possiamo offrire un codice sconto per il primo mese di Pro mensile. Ogni codice è monouso, valido ${DISCOUNT_CODE_VALID_DAYS} giorni, si applica solo al primo pagamento mensile ed è limitato a uno per account. Il grado utilizzato è calcolato da noi in base all’attività sincronizzata con il tuo account. I codici sconto non hanno valore monetario, non sono trasferibili e non costituiscono un diritto; possiamo modificare, sospendere o terminare queste offerte in qualsiasi momento, senza effetti su un codice già emesso e ancora valido.`,
        ],
      },
      {
        heading: `6. Pagamenti tramite ${MOR}`,
        blocks: [
          `Gli abbonamenti Pro sono venduti da ${MOR}, il nostro rivenditore e Merchant of Record. ${MOR} elabora il pagamento, riscuote e versa le imposte applicabili, emette ricevute e fatture e gestisce i rimborsi. Acquistando Pro, accetti anche le condizioni per gli acquirenti di ${MOR}, che si applicano all’acquisto stesso.`,
          'Non vediamo né conserviamo mai i dati completi della tua carta. Riceviamo solo le informazioni necessarie per collegare l’abbonamento al tuo account Moneo (ad esempio stato, piano e data di rinnovo).',
        ],
      },
      {
        heading: '7. Rinnovo automatico e disdetta',
        blocks: [
          'Gli abbonamenti si rinnovano automaticamente alla fine di ogni periodo di fatturazione (mensile o annuale) e vengono addebitati sul tuo metodo di pagamento finché non disdici.',
          'Puoi disdire in qualsiasi momento dal portale clienti (Account → Gestisci abbonamento) o scrivendo a {email}. La disdetta interrompe i rinnovi futuri; mantieni Pro fino alla fine del periodo già pagato, poi il tuo account torna al piano gratuito.',
          'Se modifichiamo il prezzo di Pro, te lo comunicheremo in anticipo. Il nuovo prezzo si applica solo dal tuo prossimo rinnovo e puoi disdire prima che entri in vigore.',
        ],
      },
      {
        heading: '8. Rimborsi',
        blocks: [
          `Puoi ottenere un rimborso completo entro ${REFUND_DAYS} giorni da un pagamento, senza dover dare spiegazioni. I dettagli e la procedura sono nella nostra {refund}.`,
        ],
      },
      {
        heading: '9. Uso consentito',
        blocks: [
          'Ti impegni a non:',
          {
            list: [
              'violare la legge o i diritti altrui durante l’uso del Servizio;',
              'tentare di accedere ai dati di altri utenti, né sondare, scansionare o attaccare i nostri sistemi;',
              'aggirare i limiti dei piani, i pagamenti o le misure di sicurezza, né rivendere il Servizio;',
              'sovraccaricare il Servizio con richieste automatizzate né usarlo per inviare spam o malware.',
            ],
          },
        ],
      },
      {
        heading: '10. I tuoi contenuti',
        blocks: [
          'Tutto ciò che crei in Moneo è tuo: sessioni, attività, note e altri dati. Non ne rivendichiamo la proprietà.',
          'Ci concedi solo l’autorizzazione limitata necessaria per salvare, sincronizzare e mostrarti i tuoi contenuti, così da poter gestire il Servizio. Non vendiamo i tuoi dati e non li usiamo per la pubblicità.',
        ],
      },
      {
        heading: '11. Funzioni di IA',
        blocks: [
          'Alcune funzioni suggeriscono piani, passi o risposte. Possono usare regole sul dispositivo o un modello di IA. I risultati dell’IA possono essere errati, incompleti o non aggiornati. Non costituiscono una consulenza professionale (medica, legale, finanziaria o di altro tipo). Verifica i suggerimenti prima di farvi affidamento.',
          'Pro include fino a 3 piani IA al giorno, generati tramite il nostro server con Cloudflare Workers AI. Possiamo modificare questa quota perché il Servizio resti sostenibile; quando è esaurita, o l’IA non è disponibile, i piani vengono creati sul tuo dispositivo.',
          'Gli utenti Pro possono anche collegare la propria chiave API di un fornitore di IA (ad esempio Google Gemini, OpenAI o DeepSeek). La chiave è salvata solo nel tuo browser. Le richieste partono direttamente dal tuo browser verso quel fornitore, in base al tuo accordo con esso. Sei responsabile della tua chiave, degli eventuali costi del fornitore e del rispetto delle sue condizioni. Evita di inviare dati personali sensibili alle funzioni di IA.',
        ],
      },
      {
        heading: '12. Servizi di terze parti',
        blocks: [
          'Le integrazioni facoltative, come l’accesso con Google o Google Calendar, sono fornite da terzi secondo le loro condizioni. Non siamo responsabili dei servizi che non controlliamo.',
        ],
      },
      {
        heading: '13. Disponibilità e modifiche del Servizio',
        blocks: [
          'Ci impegniamo a mantenere Moneo disponibile e i tuoi dati al sicuro, ma non possiamo garantire che il Servizio sia sempre privo di interruzioni o errori. Poiché i dati sono salvati prima di tutto sul tuo dispositivo, cancellare i dati del browser può eliminarli. Conserva backup personali di tutto ciò che è importante (ad esempio con l’export JSON gratuito nelle Impostazioni).',
          'Possiamo aggiungere, modificare o rimuovere funzioni. Se smettiamo del tutto di offrire Pro, rimborseremo la parte non utilizzata di qualsiasi abbonamento prepagato.',
        ],
      },
      {
        heading: '14. Nessuna garanzia',
        blocks: [
          'Nei limiti consentiti dalla legge, il Servizio è fornito «così com’è» e «come disponibile», senza garanzie di alcun tipo, espresse o implicite, inclusa l’idoneità a uno scopo particolare. Nulla nei presenti Termini limita i diritti che hai come consumatore in base a norme imperative.',
        ],
      },
      {
        heading: '15. Limitazione di responsabilità',
        blocks: [
          'Nei limiti consentiti dalla legge, non siamo responsabili di perdite indirette o consequenziali, come mancati profitti, perdita di dati o opportunità perse. La nostra responsabilità complessiva per qualsiasi pretesa relativa al Servizio è limitata all’importo che hai pagato per Moneo nei 12 mesi precedenti la pretesa.',
          'Questi limiti non si applicano alla responsabilità che la legge non consente di limitare, come quella per dolo, colpa grave o morte o lesioni personali causate da negligenza.',
        ],
      },
      {
        heading: '16. Cessazione',
        blocks: [
          'Puoi smettere di usare Moneo in qualsiasi momento ed eliminare il tuo account dalla pagina Account.',
          'Possiamo sospendere o chiudere un account che viola gravemente o ripetutamente i presenti Termini, o quando lo richiede la legge. Quando è ragionevole, ti avviseremo prima e ti daremo modo di esportare i tuoi dati. Se chiudiamo il tuo account senza una tua violazione, rimborseremo la parte non utilizzata di qualsiasi abbonamento prepagato.',
        ],
      },
      {
        heading: '17. Modifiche ai presenti Termini',
        blocks: [
          'Possiamo aggiornare i presenti Termini. Se una modifica è rilevante, te lo comunicheremo nell’app o via e-mail prima che entri in vigore. La data di «Ultimo aggiornamento» in alto indica la versione corrente. Se continui a usare il Servizio dopo l’entrata in vigore di una modifica, si applicano i nuovi Termini; se non sei d’accordo, puoi disdire ed eliminare il tuo account.',
        ],
      },
      {
        heading: '18. Legge applicabile',
        blocks: [
          `I presenti Termini sono regolati dalle leggi della ${SELLER.country.it} e le controversie sono di competenza dei suoi tribunali.`,
          'Se sei un consumatore residente nell’Unione europea o nello Spazio economico europeo, mantieni inoltre la tutela delle norme imperative a protezione dei consumatori del tuo Paese di residenza e puoi agire davanti ai tribunali di quel Paese.',
        ],
      },
      {
        heading: '19. Contatti',
        blocks: [
          `Domande sui presenti Termini? Scrivi a ${SELLER.initials} all’indirizzo {email}.`,
        ],
      },
    ],
  },

  privacy: {
    title: 'Informativa sulla privacy',
    updated: UPDATED,
    intro: [
      'Questa informativa spiega quali dati personali tratta Moneo, perché, chi ci aiuta a trattarli e quali scelte e diritti hai. Moneo funziona in modalità «local-first»: per impostazione predefinita i tuoi dati restano nel browser, sul tuo dispositivo.',
    ],
    sections: [
      {
        heading: '1. Chi è responsabile dei tuoi dati',
        blocks: [`Il titolare del trattamento è ${OPERATOR}. Contatto: {email}.`],
      },
      {
        heading: '2. Dati che restano sul tuo dispositivo',
        blocks: [
          'Tutto ciò che crei viene salvato prima nella memoria locale del browser sul tuo dispositivo: sessioni di concentrazione, aree di concentrazione, impostazioni, progetti, attività, piani giornalieri, blocchi di tempo, obiettivi, OKR, competenze, abitudini, voci del diario e dell’energia, cronologia della chat con l’assistente e dati simili. Non possiamo vedere questi dati. Restano sul tuo dispositivo finché non attivi la sincronizzazione cloud (vedi sotto).',
          'Se aggiungi la tua chiave API di un fornitore di IA, anche questa è salvata solo nel tuo browser. Non viene mai inviata ai server di Moneo.',
        ],
      },
      {
        heading: '3. Dati che trattiamo',
        blocks: [
          {
            list: [
              'Account: il tuo indirizzo e-mail, una password sottoposta a hash (se ne usi una), il metodo di accesso e le date dell’account, gestiti dal nostro fornitore di autenticazione. Se accedi con Google, riceviamo da Google il tuo indirizzo e-mail e i dati di base del profilo.',
              'Profilo: il tuo fuso orario, per contare correttamente le tue giornate.',
              'Sincronizzazione cloud (con un account, solo dopo averla attivata): sessioni di concentrazione (durata, orario, testo dell’intenzione, area), aree di concentrazione, impostazioni e un identificativo casuale del dispositivo per unire le modifiche tra dispositivi.',
              'Sincronizzazione completa (solo Pro, con la sincronizzazione attiva): gli altri tuoi dati di pianificazione — progetti, attività, obiettivi, OKR, abitudini e registrazioni delle abitudini, voci del diario e dell’energia, aree di vita e mappa della vita, competenze, blocchi di tempo, piani giornalieri, sprint, impostazioni della bacheca, piani a cascata, collegamenti, filtri salvati e roadmap — insieme all’ora dell’ultima modifica o eliminazione di ciascun elemento. La cronologia della chat con l’assistente e le chiavi IA non vengono sincronizzate. Se Pro termina, la copia già presente nell’account viene conservata ma non più aggiornata, e i dati sul dispositivo non vengono toccati.',
              'Abbonamento: piano, stato, data di rinnovo e identificativi cliente e abbonamento di Lemon Squeezy, ricevuti da Lemon Squeezy per sapere se hai Pro.',
              'Focus buddy (facoltativo, Pro): se ti abbini a un buddy, un codice di invito e l’abbinamento; il tuo buddy vede solo i tuoi minuti di concentrazione di oggi.',
              'Google Calendar (facoltativo, Pro): se lo colleghi, un token che ci permette di leggere i tuoi eventi (sola lettura) per mostrare i conflitti con il tuo piano. Gli eventi vengono recuperati quando serve e non li conserviamo. Puoi scollegarlo in qualsiasi momento.',
              'Segnalazioni di errore: se l’app si blocca, un messaggio di errore tecnico e uno stack trace. Le segnalazioni non sono collegate al tuo account e non sono pensate per contenere i tuoi contenuti.',
              'Dati di sicurezza: indirizzo IP e dati della richiesta, trattati brevemente dal nostro fornitore di hosting e dalla protezione anti-bot del modulo di accesso, per proteggere il Servizio dagli abusi.',
              'Statistiche di utilizzo: Cloudflare Web Analytics conta le visualizzazioni di pagina e misura le prestazioni. Registra l’indirizzo della pagina, il sito di provenienza, il Paese e il tipo di browser e dispositivo, e ci mostra solo totali aggregati. Non usa cookie, non usa la memoria del browser per tracciarti, non ti identifica e non ti segue su altri siti.',
              'Contatori di prodotto anonimi: quando raggiungi alcuni passaggi nell’app (ad esempio completare i passaggi di benvenuto, il tuo primo round di concentrazione o aprire il pagamento), Moneo conta il passaggio solo insieme al piano scelto e alla lingua dell’interfaccia — senza identificativo dell’account, indirizzo IP, identificativo del dispositivo o contenuti — per capire quali parti di Moneo funzionano. Annotiamo anche il canale da cui sei arrivato — un’etichetta di campagna nel link (ad esempio utm_source=tiktok) o il nome del sito di provenienza — e conserviamo solo questa breve etichetta nel tuo browser per 30 giorni, per vedere quali canali portano a iscrizioni e abbonamenti; non ti identifica. Attivare Do Not Track o Global Privacy Control nel browser interrompe questi contatori.',
              'Messaggi che ci invii: il tuo indirizzo e-mail e il contenuto del messaggio.',
            ],
          },
          'I dati di fatturazione (nome, indirizzo di fatturazione, dati della carta) sono raccolti e conservati da Lemon Squeezy in qualità di Merchant of Record, non da Moneo.',
        ],
      },
      {
        heading: '4. Funzioni di IA',
        blocks: [
          'Per impostazione predefinita, i piani in stile IA sono creati sul tuo dispositivo con semplici regole e nulla viene inviato altrove.',
          'Piani IA inclusi (Pro): tramite il nostro server vengono inviati a Cloudflare Workers AI solo il testo dell’obiettivo (fino a 500 caratteri), l’orizzonte, le ore a settimana e il livello. Nessuna sessione, attività, voce di diario o dato dell’account; richiesta e risposta non vengono conservate da noi e Cloudflare non le usa per addestrare modelli. Contiamo solo quanti piani ha creato ogni account al giorno (cancellato dopo due giorni).',
          'Se hai Pro e aggiungi la tua chiave API per Google Gemini, OpenAI o DeepSeek, l’obiettivo che scrivi e i dettagli di pianificazione (orizzonte, ore a settimana, livello) vengono inviati direttamente dal tuo browser a quel fornitore. Il fornitore li tratta secondo la propria informativa sulla privacy, come tuo fornitore di servizi e non nostro.',
          'L’input vocale dell’assistente usa il riconoscimento vocale integrato del browser. Alcuni browser (ad esempio Chrome) inviano l’audio ai server del produttore del browser per trascriverlo.',
        ],
      },
      {
        heading: '5. Perché usiamo i tuoi dati (basi giuridiche)',
        blocks: [
          'Trattiamo i dati personali ai sensi del Regolamento generale sulla protezione dei dati dell’UE (GDPR) per gli utenti nell’UE/SEE e della Legge della Repubblica di Moldova n. 195/2024 sulla protezione dei dati personali, in vigore dal 23 agosto 2026 (che ha sostituito la Legge n. 133/2011).',
          {
            list: [
              'Per fornire il Servizio che hai richiesto — account, sincronizzazione, funzioni Pro e stato della fatturazione (esecuzione di un contratto).',
              'Per mantenere il Servizio sicuro e funzionante — protezione anti-bot, limiti di frequenza e segnalazioni di errore (il nostro legittimo interesse a un’app sicura e affidabile).',
              'Per capire, in forma aggregata, quali pagine vengono usate e quanto velocemente si caricano — Cloudflare Web Analytics senza cookie (il nostro legittimo interesse a migliorare il Servizio).',
              'Per le funzioni facoltative che attivi — Google Calendar, focus buddy, la tua chiave IA (il tuo consenso, che puoi revocare in qualsiasi momento disattivando la funzione).',
              'Per adempiere agli obblighi di legge, ad esempio conservare documenti quando la legge lo richiede.',
              'Per inviarti un’email di benvenuto dopo la creazione dell’account e, se non usi Moneo da una settimana, un solo promemoria. Ognuna contiene un link per annullare l’iscrizione con un clic (nostro legittimo interesse ad aiutarti a iniziare; puoi opporti in qualsiasi momento).',
            ],
          },
        ],
      },
      {
        heading: '6. Fornitori di servizi (responsabili del trattamento)',
        blocks: [
          'Usiamo questi fornitori per far funzionare Moneo. Trattano i dati solo secondo le nostre istruzioni o, dove indicato, come titolari autonomi:',
          {
            list: [
              'Supabase — autenticazione e database cloud (ospitato nell’UE, in Irlanda). Invia anche le e-mail di accesso, conferma e reimpostazione della password, direttamente o tramite un servizio di invio e-mail che configuriamo.',
              'Cloudflare — hosting, distribuzione dei contenuti, sicurezza, protezione anti-bot Turnstile nei moduli di accesso e Web Analytics senza cookie (rete globale).',
              'Lemon Squeezy — checkout, pagamenti, imposte, fatture e rimborsi in qualità di Merchant of Record (titolare autonomo per i dati di fatturazione; USA).',
              'Google — accesso con Google e, se lo colleghi, Google Calendar (USA).',
              'Sentry (Functional Software, Inc.) — segnalazioni di errore (dati conservati nell’UE, in Germania).',
              'GitHub (Microsoft) — conserva i nostri backup settimanali crittografati del database (USA).',
              'I fornitori di IA che scegli tu (Google Gemini, OpenAI, DeepSeek) — solo se aggiungi la tua chiave.',
              'Resend — invia le email di Moneo: accesso, conferma e reimpostazione della password, oltre alle email di benvenuto e di promemoria (USA).',
              'Cloudflare Workers AI — genera i piani IA inclusi in Pro (riceve solo il testo dell’obiettivo e le impostazioni del piano; non viene conservato nulla).',
            ],
          },
          'Non vendiamo i tuoi dati personali e non li condividiamo con inserzionisti o intermediari di dati.',
        ],
      },
      {
        heading: '7. Trasferimenti internazionali',
        blocks: [
          'Alcuni fornitori si trovano fuori dal tuo Paese, anche negli Stati Uniti e, per DeepSeek se lo scegli, in Cina. Dove si applica il GDPR, i trasferimenti si basano su decisioni di adeguatezza (come il Data Privacy Framework UE-USA per i fornitori certificati) o sulle clausole contrattuali tipo della Commissione europea.',
          'Per gli utenti nella Repubblica di Moldova, ai trasferimenti si applicano le stesse garanzie ai sensi della Legge n. 195/2024.',
        ],
      },
      {
        heading: '8. Per quanto tempo conserviamo i dati',
        blocks: [
          {
            list: [
              'Dati sul tuo dispositivo: finché non li elimini o non cancelli i dati del browser.',
              'Dati dell’account e del cloud: finché non elimini l’account. L’eliminazione li rimuove subito dal database attivo; le copie nei backup crittografati scadono entro 30 giorni.',
              'Segnalazioni di errore: fino a 90 giorni.',
              'Statistiche di utilizzo: conservate da Cloudflare solo come totali aggregati che non ti identificano.',
              'Log di sicurezza presso il nostro fornitore di hosting: periodi brevi, di solito pochi giorni.',
              'E-mail all’assistenza: per il tempo necessario a gestire la tua richiesta e al massimo 2 anni.',
              'Documenti di fatturazione: conservati da Lemon Squeezy per il tempo richiesto dalle leggi fiscali e contabili.',
              'Contatori anonimi del prodotto (per passo, piano, lingua e canale): fino a 3 mesi, poi eliminati automaticamente.',
            ],
          },
        ],
      },
      {
        heading: '9. I tuoi diritti e le tue scelte',
        blocks: [
          'Hai il diritto di accedere ai tuoi dati personali, rettificarli, esportarli o cancellarli, di opporti a determinati trattamenti o di limitarli, di revocare il consenso in qualsiasi momento e alla portabilità dei dati.',
          {
            list: [
              'Eliminare i dati su questo dispositivo: Impostazioni → «Elimina tutti i dati su questo dispositivo».',
              'Eliminare l’account e i dati cloud: Account → «Elimina account». Se hai un abbonamento attivo, disdicilo prima nel portale clienti.',
              'Accesso e portabilità: nelle Impostazioni chiunque può esportare gratuitamente tutti i propri dati Moneo in un file JSON e importarli su un altro dispositivo. Pro aggiunge formati di report aggiuntivi (CSV/PDF). Per qualsiasi altra richiesta, scrivi a {email}.',
              'Interrompi la sincronizzazione cloud uscendo dall’account; i tuoi dati restano sul dispositivo.',
            ],
          },
          'Rispondiamo alle richieste entro un mese. Puoi anche presentare reclamo a un’autorità di protezione dei dati: nella Repubblica di Moldova, il Centro nazionale per la protezione dei dati personali; nell’UE/SEE, l’autorità del tuo Paese di residenza (in Italia, il Garante per la protezione dei dati personali).',
        ],
      },
      {
        heading: '10. Cookie e memoria locale',
        blocks: [
          'Moneo non usa cookie pubblicitari, tracker pubblicitari, pixel di tracciamento né tracciamento tra siti. Per le statistiche di utilizzo usiamo Cloudflare Web Analytics, che funziona senza cookie e non salva nulla nel browser per riconoscerti. Usiamo la memoria locale del browser per salvare i tuoi dati e la sessione di accesso, il che è strettamente necessario per il funzionamento dell’app. Cloudflare e Turnstile possono impostare cookie di sicurezza strettamente necessari per distinguere le persone dai bot. Il checkout di Lemon Squeezy, che si apre sul sito di Lemon Squeezy, usa i propri cookie.',
          'I caratteri sono serviti dal nostro dominio; non carichiamo Google Fonts né altri tracker di terze parti.',
        ],
      },
      {
        heading: '11. Sicurezza',
        blocks: [
          'I dati viaggiano su connessioni crittografate (HTTPS/TLS). I dati cloud sono protetti da regole di accesso in modo che solo il tuo account possa leggerli, e i backup del database sono crittografati. Moneo non è crittografato end-to-end e nessun sistema è sicuro al 100 %, quindi usa una password robusta e unica.',
          'Se un incidente di sicurezza mette a rischio dati personali, lo notifichiamo all’autorità competente — nella Repubblica di Moldova, il Centro nazionale per la protezione dei dati personali — entro 72 ore da quando ne veniamo a conoscenza e informiamo senza ingiustificato ritardo gli utenti interessati quando il rischio per loro è elevato. Teniamo un registro interno delle attività di trattamento e degli eventuali incidenti.',
        ],
      },
      {
        heading: '12. Bambini e studenti',
        blocks: [
          `Moneo è usato da alunni, studenti universitari e adulti. Per un account è richiesta un’età minima di ${MIN_ACCOUNT_AGE} anni. Gli utenti con meno di ${ADULT_AGE} anni hanno bisogno del permesso di un genitore o di un tutore legale e, al di sotto dell’età del consenso digitale del loro Paese (${DIGITAL_CONSENT_AGE} anni in molti Paesi dell’UE), un genitore o un tutore legale deve acconsentire alla creazione dell’account.`,
          {
            list: [
              'Senza account non ci viene inviato nulla: tutti i dati restano sul dispositivo. È il modo più sicuro per i più giovani di usare Moneo.',
              'Con un account raccogliamo dai minori gli stessi dati minimi raccolti da chiunque altro (vedi la sezione 3), nulla di più.',
              'Nessuna pubblicità, nessuna profilazione e nessuna vendita di dati, per nessuno, minori compresi.',
              'Genitori e tutori legali possono chiedere di consultare, esportare o eliminare i dati del proprio figlio scrivendo a {email}.',
              `Se veniamo a sapere che un bambino con meno di ${MIN_ACCOUNT_AGE} anni ha creato un account, eliminiamo l’account e i suoi dati.`,
            ],
          },
        ],
      },
      {
        heading: '13. Modifiche a questa informativa',
        blocks: [
          'Possiamo aggiornare questa informativa. Se una modifica è rilevante, te lo comunicheremo nell’app o via e-mail. La data di «Ultimo aggiornamento» in alto indica la versione corrente.',
        ],
      },
      {
        heading: '14. Contatti',
        blocks: [
          `Per domande o richieste sulla privacy, scrivi a ${SELLER.initials} all’indirizzo {email}.`,
        ],
      },
    ],
  },

  refund: {
    title: 'Politica di rimborso',
    updated: UPDATED,
    intro: [
      `Vogliamo che tu sia soddisfatto di Moneo Pro. Se non lo sei, puoi riavere i tuoi soldi entro ${REFUND_DAYS} giorni, senza domande.`,
    ],
    sections: [
      {
        heading: `1. Garanzia soddisfatti o rimborsati di ${REFUND_DAYS} giorni`,
        blocks: [
          `Puoi chiedere il rimborso completo di qualsiasi pagamento Pro — il primo acquisto o un rinnovo, mensile o annuale — entro ${REFUND_DAYS} giorni dalla data del pagamento. Non devi indicare un motivo.`,
        ],
      },
      {
        heading: '2. Come chiedere un rimborso',
        blocks: [
          {
            list: [
              'Scrivi a {email} dall’indirizzo usato al checkout, oppure indica quell’indirizzo e il numero d’ordine (lo trovi nell’e-mail di ricevuta di Lemon Squeezy).',
              'Oppure trova l’ordine nell’e-mail di ricevuta di Lemon Squeezy o su {orders} e chiedi lì il rimborso.',
            ],
          },
        ],
      },
      {
        heading: '3. Chi gestisce il rimborso',
        blocks: [
          `I pagamenti sono gestiti da ${MOR}, il nostro Merchant of Record. Una volta approvata la tua richiesta, ${MOR} restituisce il denaro sul metodo di pagamento originale, comprese le imposte pagate. I rimborsi di solito compaiono entro 5–10 giorni lavorativi, a seconda della banca o dell’emittente della carta.`,
        ],
      },
      {
        heading: '4. Cosa succede a Pro dopo un rimborso',
        blocks: [
          'Un rimborso disdice anche l’abbonamento, quindi non ti verrà addebitato altro. Le funzioni Pro terminano quando il rimborso viene elaborato e il tuo account torna al piano gratuito.',
          'I tuoi dati non vengono eliminati: tutto ciò che si trova sul dispositivo resta lì, e i dati già sincronizzati con l’account vi restano finché non elimini l’account. La sincronizzazione completa di tutti i dati è una funzione Pro, quindi smette di aggiornarsi; sessioni di concentrazione, aree di concentrazione e impostazioni continuano a sincronizzarsi.',
        ],
      },
      {
        heading: '5. Disdire non è come ottenere un rimborso',
        blocks: [
          {
            list: [
              'Disdetta: interrompe i rinnovi futuri. Mantieni Pro fino alla fine del periodo già pagato. Non viene restituito denaro. Puoi disdire in qualsiasi momento nel portale clienti (Account → Gestisci abbonamento).',
              `Rimborso: restituisce il denaro di un pagamento effettuato negli ultimi ${REFUND_DAYS} giorni e termina Pro immediatamente.`,
            ],
          },
        ],
      },
      {
        heading: `6. Dopo ${REFUND_DAYS} giorni`,
        blocks: [
          `Dopo ${REFUND_DAYS} giorni i pagamenti in genere non sono rimborsabili, ma puoi comunque disdire in qualsiasi momento per interrompere gli addebiti futuri. Correggeremo sempre gli errori di fatturazione, come un addebito doppio, e rimborseremo quando la legge lo richiede. Se smettiamo di offrire Pro, rimborseremo la parte non utilizzata di qualsiasi periodo prepagato.`,
          `Questa politica non limita i diritti che ti riconosce il diritto imperativo dei consumatori, incluso il diritto di recesso dell’UE, già coperto da questa garanzia di ${REFUND_DAYS} giorni.`,
        ],
      },
      {
        heading: '7. Contatti',
        blocks: [
          `Domande su fatturazione o rimborsi? Scrivi a {email}. Vedi anche i nostri {terms}.`,
        ],
      },
    ],
  },
};

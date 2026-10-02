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

const OPERATOR = `${SELLER.name}, ${SELLER.entity.de} mit Sitz in der ${SELLER.country.de}`;
const UPDATED = `Zuletzt aktualisiert: ${formatLegalDate('de')}`;
const MOR = MERCHANT_OF_RECORD;

/** German translation. The English version (en.ts) is the legally binding one. */
export const legalDe: LegalSet = {
  terms: {
    title: 'Nutzungsbedingungen',
    updated: UPDATED,
    intro: [
      `Diese Nutzungsbedingungen („Bedingungen“) regeln deine Nutzung von Moneo, dem Fokus-Timer und Planer, der unter ${SITE_URL} und als installierbare Web-App verfügbar ist (der „Dienst“). Bitte lies sie zusammen mit unserer {privacy} und unseren {refund}.`,
    ],
    sections: [
      {
        heading: '1. Wer Moneo betreibt',
        blocks: [
          `Moneo wird von ${OPERATOR} betrieben („wir“, „uns“). Du erreichst uns unter {email}.`,
        ],
      },
      {
        heading: '2. Annahme dieser Bedingungen und wer Moneo nutzen darf',
        blocks: [
          'Indem du den Dienst nutzt oder ein Konto erstellst, stimmst du diesen Bedingungen zu. Wenn du nicht einverstanden bist, nutze den Dienst bitte nicht.',
          'Moneo ist für Schüler, Studierende und Erwachsene gemacht. Du kannst es ohne Konto nutzen: Deine Daten bleiben dann auf deinem Gerät und nichts wird an uns gesendet. Das ist die sicherste Option für jüngere Nutzer.',
          {
            list: [
              `Um ein Konto zu erstellen, musst du mindestens ${MIN_ACCOUNT_AGE} Jahre alt sein.`,
              `Wenn du jünger als ${ADULT_AGE} bist, darfst du Moneo nur mit Erlaubnis eines Elternteils oder Erziehungsberechtigten nutzen.`,
              `Wenn du jünger als das Alter der digitalen Einwilligung in deinem Land bist (in vielen EU-Ländern ${DIGITAL_CONSENT_AGE}), muss ein Elternteil oder Erziehungsberechtigter zustimmen, bevor du ein Konto erstellst.`,
              `Ein Pro-Abonnement für eine Person unter ${ADULT_AGE} muss von einem Elternteil oder Erziehungsberechtigten oder mit dessen Erlaubnis abgeschlossen werden.`,
            ],
          },
          'Ein Elternteil oder Erziehungsberechtigter, der einer minderjährigen Person die Nutzung von Moneo erlaubt, stimmt diesen Bedingungen in deren Namen zu und ist für die Beaufsichtigung dieser Nutzung verantwortlich. Die Fähigkeit Minderjähriger, Vereinbarungen zu schließen, richtet sich nach dem anwendbaren Recht.',
        ],
      },
      {
        heading: '3. Der Dienst',
        blocks: [
          'Moneo hilft dir, deinen Tag zu planen und Fokus-Sitzungen durchzuführen. Es arbeitet „local-first“: Die meisten Funktionen funktionieren ohne Konto, und deine Daten werden in deinem Browser auf deinem Gerät gespeichert.',
          'Mit einem Konto kannst du Fokus-Sitzungen, Fokusbereiche und Einstellungen mit unserer Cloud-Datenbank synchronisieren. Mit Pro werden auch deine übrigen Planungsdaten (Projekte, Aufgaben, Pläne, Ziele, Gewohnheiten, Journaleinträge und Ähnliches) in deinem Konto gespeichert und zwischen deinen Geräten synchronisiert. Im kostenlosen Plan bleiben diese Planungsdaten auf deinem Gerät.',
          'Hilfe, keine Ergebnisse: Moneo ist ein Werkzeug, das dir hilft, Zeit, Pläne, Gewohnheiten und Ziele zu organisieren. Wir stellen die Werkzeuge und Vorschläge bereit; was du erreichst, hängt von dir ab. Wir versprechen kein bestimmtes Ergebnis — zum Beispiel bessere Noten, eine bestandene Prüfung, einen Job, ein höheres Einkommen, Gewichtsverlust oder ein bestimmtes Maß an Produktivität.',
          'Gesundheit und Training: Bewegung, die Übungsbibliothek und die Trainingsprogramme sind allgemeine Informationen, keine medizinische, physiotherapeutische oder Ernährungsberatung, und sie ersetzen keinen Arzt und keinen qualifizierten Trainer. Sprich mit einem Arzt, bevor du ein neues Trainingsprogramm beginnst, besonders wenn du eine Erkrankung oder Verletzung hast oder schwanger bist. Hör auf, wenn du Schmerzen, Schwindel oder Atemnot spürst. Du trainierst auf eigenes Risiko, und wir versprechen kein bestimmtes Ergebnis.',
        ],
      },
      {
        heading: '4. Dein Konto',
        blocks: [
          'Du kannst dich mit E-Mail-Adresse und Passwort oder mit Google registrieren. Bitte gib eine gültige E-Mail-Adresse an, halte dein Passwort geheim und informiere uns unter {email}, wenn du glaubst, dass jemand anderes auf dein Konto zugegriffen hat. Du bist für die Aktivitäten unter deinem Konto verantwortlich.',
          'Du kannst dein Konto jederzeit auf der Kontoseite löschen („Konto löschen“).',
        ],
      },
      {
        heading: '5. Kostenloser Plan und Pro',
        blocks: [
          'Der kostenlose Plan hat kein Zeitlimit. Er umfasst den Fokus-Timer und eine begrenzte Anzahl an Projekten, Zielen, Gewohnheiten und anderen Elementen. Wir können die Grenzen des kostenlosen Plans künftig anpassen; wegen einer Änderung der Grenzen löschen wir keine Daten, die du bereits erstellt hast.',
          `Pro ist ein kostenpflichtiges Abonnement: ${PRO_PRICES.monthly} pro Monat oder ${PRO_PRICES.yearly} pro Jahr. Je nach Wohnort können beim Bezahlen Steuern wie die Mehrwertsteuer hinzukommen. Die aktuelle Liste der Pro-Funktionen steht auf der Preisseite.`,
          'Kostenlose Testphase: Wird auf der Preisseite eine Testphase angeboten, steht sie einmal pro Konto zur Verfügung, das noch nie ein Abonnement hatte. Kündigst du vor dem Ende der Testphase, zahlst du nichts; andernfalls beginnt das Abonnement und verlängert sich zum angezeigten Preis.',
          `Rang-Rabatte: Erreicht ein Konto ohne Pro bestimmte XP-Ränge, können wir einen Rabattcode für den ersten Monat von Pro monatlich anbieten. Jeder Code ist einmalig nutzbar, ${DISCOUNT_CODE_VALID_DAYS} Tage gültig, gilt nur für die erste Monatszahlung und ist auf einen pro Konto begrenzt. Den dafür maßgeblichen Rang berechnen wir aus der mit deinem Konto synchronisierten Aktivität. Rabattcodes haben keinen Geldwert, sind nicht übertragbar und begründen keinen Anspruch; wir können diese Angebote jederzeit ändern, aussetzen oder beenden, ohne einen bereits ausgegebenen und noch gültigen Code zu beeinträchtigen.`,
        ],
      },
      {
        heading: `6. Zahlungen über ${MOR}`,
        blocks: [
          `Pro-Abonnements werden von ${MOR} verkauft, unserem Wiederverkäufer und Merchant of Record. ${MOR} wickelt deine Zahlung ab, erhebt und führt anfallende Steuern ab, stellt Belege und Rechnungen aus und bearbeitet Erstattungen. Beim Kauf von Pro akzeptierst du zusätzlich die Käuferbedingungen von ${MOR}, die für den Kauf selbst gelten.`,
          'Wir sehen oder speichern niemals deine vollständigen Kartendaten. Wir erhalten nur die Informationen, die nötig sind, um das Abonnement mit deinem Moneo-Konto zu verknüpfen (zum Beispiel Status, Plan und Verlängerungsdatum).',
        ],
      },
      {
        heading: '7. Automatische Verlängerung und Kündigung',
        blocks: [
          'Abonnements verlängern sich am Ende jedes Abrechnungszeitraums (monatlich oder jährlich) automatisch und werden deiner Zahlungsmethode belastet, bis du kündigst.',
          'Du kannst jederzeit im Kundenportal (Konto → Abo verwalten) oder per E-Mail an {email} kündigen. Die Kündigung stoppt künftige Verlängerungen; Pro bleibt bis zum Ende des bereits bezahlten Zeitraums aktiv, danach kehrt dein Konto zum kostenlosen Plan zurück.',
          'Ändern wir den Preis von Pro, informieren wir dich im Voraus. Ein neuer Preis gilt erst ab deiner nächsten Verlängerung, und du kannst vorher kündigen.',
        ],
      },
      {
        heading: '8. Erstattungen',
        blocks: [
          `Du kannst innerhalb von ${REFUND_DAYS} Tagen nach einer Zahlung ohne Angabe von Gründen eine volle Erstattung erhalten. Einzelheiten und das Vorgehen findest du in unseren {refund}.`,
        ],
      },
      {
        heading: '9. Zulässige Nutzung',
        blocks: [
          'Du verpflichtest dich, Folgendes zu unterlassen:',
          {
            list: [
              'bei der Nutzung des Dienstes gegen Gesetze oder die Rechte anderer zu verstoßen;',
              'zu versuchen, auf Daten anderer Nutzer zuzugreifen, oder unsere Systeme zu untersuchen, zu scannen oder anzugreifen;',
              'Plangrenzen, Zahlungen oder Sicherheitsmaßnahmen zu umgehen oder den Dienst weiterzuverkaufen;',
              'den Dienst mit automatisierten Anfragen zu überlasten oder ihn zum Versand von Spam oder Schadsoftware zu nutzen.',
            ],
          },
        ],
      },
      {
        heading: '10. Deine Inhalte',
        blocks: [
          'Alles, was du in Moneo erstellst, gehört dir: Sitzungen, Aufgaben, Notizen und andere Daten. Wir beanspruchen daran kein Eigentum.',
          'Du gewährst uns nur die eingeschränkte Erlaubnis, die nötig ist, um deine Inhalte zu speichern, zu synchronisieren und dir anzuzeigen, damit wir den Dienst betreiben können. Wir verkaufen deine Daten nicht und nutzen sie nicht für Werbung.',
        ],
      },
      {
        heading: '11. KI-Funktionen',
        blocks: [
          'Einige Funktionen schlagen Pläne, Schritte oder Antworten vor. Sie können Regeln auf dem Gerät oder ein KI-Modell verwenden. KI-Ergebnisse können falsch, unvollständig oder veraltet sein. Sie sind keine professionelle (medizinische, rechtliche, finanzielle oder sonstige) Beratung. Bitte prüfe Vorschläge, bevor du dich darauf verlässt.',
          'Pro-Nutzer können außerdem einen eigenen API-Schlüssel eines KI-Anbieters verbinden (zum Beispiel Google Gemini, OpenAI oder DeepSeek). Dein Schlüssel wird nur in deinem Browser gespeichert. Anfragen gehen direkt von deinem Browser an diesen Anbieter, im Rahmen deiner eigenen Vereinbarung mit ihm. Du bist für deinen Schlüssel, etwaige Kosten des Anbieters und die Einhaltung seiner Bedingungen verantwortlich. Sende keine sensiblen personenbezogenen Daten an KI-Funktionen.',
        ],
      },
      {
        heading: '12. Dienste Dritter',
        blocks: [
          'Optionale Integrationen wie die Anmeldung mit Google oder Google Kalender werden von Dritten zu deren eigenen Bedingungen bereitgestellt. Für Dienste, die wir nicht kontrollieren, sind wir nicht verantwortlich.',
        ],
      },
      {
        heading: '13. Verfügbarkeit und Änderungen des Dienstes',
        blocks: [
          'Wir bemühen uns, Moneo verfügbar und deine Daten sicher zu halten, können aber nicht versprechen, dass der Dienst immer unterbrechungs- und fehlerfrei ist. Da Daten zuerst auf deinem Gerät gespeichert werden, kann das Löschen deiner Browserdaten sie entfernen. Erstelle eigene Sicherungen von allem Wichtigen (zum Beispiel mit dem kostenlosen JSON-Export in den Einstellungen).',
          'Wir können Funktionen hinzufügen, ändern oder entfernen. Stellen wir das Pro-Angebot vollständig ein, erstatten wir den ungenutzten Teil eines im Voraus bezahlten Abonnements.',
        ],
      },
      {
        heading: '14. Keine Gewährleistung',
        blocks: [
          'Soweit gesetzlich zulässig, wird der Dienst „wie besehen“ und „wie verfügbar“ bereitgestellt, ohne ausdrückliche oder stillschweigende Gewährleistung, einschließlich der Eignung für einen bestimmten Zweck. Nichts in diesen Bedingungen schränkt deine Rechte als Verbraucher nach zwingendem Recht ein.',
        ],
      },
      {
        heading: '15. Haftungsbeschränkung',
        blocks: [
          'Soweit gesetzlich zulässig, haften wir nicht für indirekte Schäden oder Folgeschäden wie entgangenen Gewinn, Datenverlust oder entgangene Chancen. Unsere Gesamthaftung für jeden Anspruch im Zusammenhang mit dem Dienst ist auf den Betrag begrenzt, den du in den 12 Monaten vor dem Anspruch für Moneo gezahlt hast.',
          'Diese Beschränkungen gelten nicht für Haftung, die gesetzlich nicht beschränkt werden kann, etwa bei Vorsatz, grober Fahrlässigkeit oder fahrlässig verursachtem Tod oder Körperverletzung.',
        ],
      },
      {
        heading: '16. Beendigung',
        blocks: [
          'Du kannst Moneo jederzeit nicht mehr nutzen und dein Konto auf der Kontoseite löschen.',
          'Wir können ein Konto sperren oder schließen, das schwer oder wiederholt gegen diese Bedingungen verstößt, oder wenn das Gesetz es verlangt. Wo es zumutbar ist, warnen wir dich zuerst und geben dir Gelegenheit, deine Daten zu exportieren. Schließen wir dein Konto ohne einen Verstoß deinerseits, erstatten wir den ungenutzten Teil eines im Voraus bezahlten Abonnements.',
        ],
      },
      {
        heading: '17. Änderungen dieser Bedingungen',
        blocks: [
          'Wir können diese Bedingungen aktualisieren. Bei wesentlichen Änderungen informieren wir dich vor ihrem Inkrafttreten in der App oder per E-Mail. Das Datum „Zuletzt aktualisiert“ oben zeigt die aktuelle Fassung. Nutzt du den Dienst nach Inkrafttreten einer Änderung weiter, gelten die neuen Bedingungen; bist du nicht einverstanden, kannst du kündigen und dein Konto löschen.',
        ],
      },
      {
        heading: '18. Anwendbares Recht',
        blocks: [
          `Diese Bedingungen unterliegen dem Recht der ${SELLER.country.de}; für Streitigkeiten sind deren zuständige Gerichte zuständig.`,
          'Bist du Verbraucher mit Wohnsitz in der Europäischen Union oder im Europäischen Wirtschaftsraum, behältst du zusätzlich den Schutz der zwingenden Verbraucherschutzgesetze deines Wohnsitzlandes und kannst vor den Gerichten dieses Landes klagen.',
        ],
      },
      {
        heading: '19. Kontakt',
        blocks: [`Fragen zu diesen Bedingungen? Schreib an ${SELLER.name} unter {email}.`],
      },
    ],
  },

  privacy: {
    title: 'Datenschutzerklärung',
    updated: UPDATED,
    intro: [
      'Diese Erklärung beschreibt, welche personenbezogenen Daten Moneo verarbeitet, warum, wer uns dabei hilft und welche Wahlmöglichkeiten und Rechte du hast. Moneo arbeitet „local-first“: Standardmäßig bleiben deine Daten in deinem Browser auf deinem Gerät.',
    ],
    sections: [
      {
        heading: '1. Wer für deine Daten verantwortlich ist',
        blocks: [`Verantwortlicher ist ${OPERATOR}. Kontakt: {email}.`],
      },
      {
        heading: '2. Daten, die auf deinem Gerät bleiben',
        blocks: [
          'Alles, was du erstellst, wird zuerst im lokalen Speicher deines Browsers auf deinem Gerät gespeichert: Fokus-Sitzungen, Fokusbereiche, Einstellungen, Projekte, Aufgaben, Tagespläne, Zeitblöcke, Ziele, OKRs, Fähigkeiten, Gewohnheiten, Journal- und Energieeinträge, der Chatverlauf mit dem Assistenten und Ähnliches. Wir können diese Daten nicht sehen. Sie bleiben auf deinem Gerät, solange du die Cloud-Synchronisierung nicht einschaltest (siehe unten).',
          'Fügst du einen eigenen API-Schlüssel eines KI-Anbieters hinzu, wird auch dieser nur in deinem Browser gespeichert. Er wird nie an die Server von Moneo gesendet.',
        ],
      },
      {
        heading: '3. Daten, die wir verarbeiten',
        blocks: [
          {
            list: [
              'Konto: deine E-Mail-Adresse, ein gehashtes Passwort (falls du eines nutzt), die Anmeldemethode und Kontozeitstempel, verarbeitet von unserem Authentifizierungsanbieter. Meldest du dich mit Google an, erhalten wir von Google deine E-Mail-Adresse und grundlegende Profildaten.',
              'Profil: deine Zeitzone, damit wir deine Tage korrekt zählen.',
              'Cloud-Synchronisierung (mit Konto, erst nachdem du sie einschaltest): Fokus-Sitzungen (Dauer, Zeit, Absichtstext, Fokusbereich), Fokusbereiche, deine Einstellungen und eine zufällige Gerätekennung, um Änderungen zwischen Geräten zusammenzuführen.',
              'Vollständige Synchronisierung (nur Pro, bei eingeschalteter Synchronisierung): deine übrigen Planungsdaten — Projekte, Aufgaben, Ziele, OKRs, Gewohnheiten und Gewohnheits-Check-ins, Journal- und Energieeinträge, Lebensbereiche und Lebenskarte, Fähigkeiten, Zeitblöcke, Tagespläne, Sprints, Board-Einstellungen, Wasserfallpläne, Verknüpfungen, gespeicherte Filter und Roadmaps — zusammen mit dem Zeitpunkt der letzten Änderung oder Löschung jedes Elements. Chatverlauf und KI-Schlüssel werden nicht synchronisiert. Endet Pro, bleibt die Kopie im Konto erhalten, wird aber nicht mehr aktualisiert, und deine Daten auf dem Gerät bleiben unberührt.',
              'Abonnement: Plan, Status, Verlängerungsdatum sowie Kunden- und Abonnement-IDs von Lemon Squeezy, die wir von Lemon Squeezy erhalten, um zu wissen, ob du Pro hast.',
              'Focus Buddy (optional, Pro): wenn du dich mit einem Buddy verbindest, ein Einladungscode und die Verbindung; dein Buddy sieht nur deine heutigen Fokusminuten.',
              'Google Kalender (optional, Pro): wenn du ihn verbindest, ein Token, mit dem wir deine Kalendertermine lesen können (nur lesend), um Überschneidungen mit deinem Plan zu zeigen. Termine werden bei Bedarf abgerufen und von uns nicht gespeichert. Du kannst die Verbindung jederzeit trennen.',
              'Fehlerberichte: wenn die App abstürzt, eine technische Fehlermeldung und ein Stacktrace. Berichte sind nicht mit deinem Konto verknüpft und sollen keine Inhalte von dir enthalten.',
              'Sicherheitsdaten: IP-Adresse und Anfragedaten, die unser Hosting-Anbieter und der Bot-Schutz im Anmeldeformular kurzzeitig verarbeiten, um den Dienst vor Missbrauch zu schützen.',
              'Nutzungsstatistiken: Cloudflare Web Analytics zählt Seitenaufrufe und misst die Ladegeschwindigkeit. Es erfasst die Seitenadresse, die verweisende Website, das Land sowie Browser- und Gerätetyp und zeigt uns nur zusammengefasste Summen. Es verwendet keine Cookies, nutzt deinen Browserspeicher nicht, um dich zu verfolgen, identifiziert dich nicht und verfolgt dich nicht über andere Websites.',
              'Anonyme Produktzähler: Wenn du einige Schritte in der App erreichst (zum Beispiel die Willkommensschritte abschließt, deine erste Fokusrunde beendest oder den Checkout öffnest), zählt Moneo den Schritt nur zusammen mit dem gewählten Plan und der Sprache der Oberfläche — ohne Konto-ID, IP-Adresse, Geräte-ID oder Inhalte —, damit wir sehen, welche Teile von Moneo funktionieren. Aktivierst du Do Not Track oder Global Privacy Control in deinem Browser, werden diese Zähler gestoppt.',
              'Nachrichten an uns: deine E-Mail-Adresse und der Inhalt deiner Nachricht.',
            ],
          },
          'Zahlungsdaten (Name, Rechnungsadresse, Kartendaten) werden von Lemon Squeezy als Merchant of Record erhoben und gespeichert, nicht von Moneo.',
        ],
      },
      {
        heading: '4. KI-Funktionen',
        blocks: [
          'Standardmäßig werden KI-ähnliche Pläne auf deinem Gerät mit einfachen Regeln erstellt, und nichts wird irgendwohin gesendet.',
          'Hast du Pro und fügst einen eigenen API-Schlüssel für Google Gemini, OpenAI oder DeepSeek hinzu, werden das eingegebene Ziel und deine Planungsangaben (Zeithorizont, Stunden pro Woche, Niveau) direkt von deinem Browser an diesen Anbieter gesendet. Der Anbieter verarbeitet sie nach seiner eigenen Datenschutzerklärung als dein Dienstleister, nicht unserer.',
          'Die Spracheingabe im Assistenten nutzt die eingebaute Spracherkennung deines Browsers. Manche Browser (zum Beispiel Chrome) senden die Audiodaten zur Umwandlung an die Server des Browserherstellers.',
        ],
      },
      {
        heading: '5. Warum wir deine Daten verwenden (Rechtsgrundlagen)',
        blocks: [
          'Wir verarbeiten personenbezogene Daten nach der EU-Datenschutz-Grundverordnung (DSGVO) für Nutzer in der EU/im EWR sowie nach dem Gesetz der Republik Moldau Nr. 133/2011 über den Schutz personenbezogener Daten (oder einem Nachfolgegesetz).',
          {
            list: [
              'Um den von dir gewünschten Dienst bereitzustellen — Konto, Synchronisierung, Pro-Funktionen und Abrechnungsstatus (Vertragserfüllung).',
              'Um den Dienst sicher und funktionsfähig zu halten — Bot-Schutz, Ratenbegrenzung und Fehlerberichte (unser berechtigtes Interesse an einer sicheren, zuverlässigen App).',
              'Um zusammengefasst zu verstehen, welche Seiten genutzt werden und wie schnell sie laden — Cloudflare Web Analytics ohne Cookies (unser berechtigtes Interesse an der Verbesserung des Dienstes).',
              'Für optionale Funktionen, die du einschaltest — Google Kalender, Focus Buddy, eigener KI-Schlüssel (deine Einwilligung, die du jederzeit widerrufen kannst, indem du die Funktion ausschaltest).',
              'Zur Erfüllung rechtlicher Pflichten, zum Beispiel zur Aufbewahrung von Unterlagen, wenn das Gesetz es verlangt.',
              'Um dir nach der Kontoerstellung eine Willkommens-E-Mail und, wenn du Moneo eine Woche nicht genutzt hast, eine einzige Erinnerung zu senden. Jede enthält einen Abmeldelink mit einem Klick (unser berechtigtes Interesse, dir den Einstieg zu erleichtern; du kannst jederzeit widersprechen).',
            ],
          },
        ],
      },
      {
        heading: '6. Dienstleister (Auftragsverarbeiter)',
        blocks: [
          'Wir nutzen diese Anbieter, um Moneo zu betreiben. Sie verarbeiten Daten nur nach unseren Weisungen oder, wo angegeben, als eigenständige Verantwortliche:',
          {
            list: [
              'Supabase — Authentifizierung und Cloud-Datenbank (gehostet in der EU, Irland). Versendet außerdem Anmelde-, Bestätigungs- und Passwort-Zurücksetzen-E-Mails, direkt oder über einen von uns eingerichteten E-Mail-Dienst.',
              'Cloudflare — Hosting, Content-Auslieferung, Sicherheit, Turnstile-Bot-Schutz in Anmeldeformularen und Web Analytics ohne Cookies (globales Netzwerk).',
              'Lemon Squeezy — Checkout, Zahlungen, Steuern, Rechnungen und Erstattungen als Merchant of Record (eigenständiger Verantwortlicher für Zahlungsdaten; USA).',
              'Google — Anmeldung mit Google und, falls du ihn verbindest, Google Kalender (USA).',
              'Sentry (Functional Software, Inc.) — Fehlerberichte (Datenspeicherung in der EU, Deutschland).',
              'GitHub (Microsoft) — speichert unsere wöchentlichen verschlüsselten Datenbanksicherungen (USA).',
              'KI-Anbieter, die du selbst wählst (Google Gemini, OpenAI, DeepSeek) — nur wenn du einen eigenen Schlüssel hinzufügst.',
              'Resend — versendet die E-Mails von Moneo: Anmeldung, Bestätigung und Passwort-Zurücksetzung sowie Willkommens- und Erinnerungs-E-Mails (USA).',
            ],
          },
          'Wir verkaufen deine personenbezogenen Daten nicht und geben sie nicht an Werbetreibende oder Datenhändler weiter.',
        ],
      },
      {
        heading: '7. Internationale Übermittlungen',
        blocks: [
          'Einige Anbieter befinden sich außerhalb deines Landes, unter anderem in den USA und — bei DeepSeek, falls du es wählst — in China. Wo die DSGVO gilt, stützen sich Übermittlungen auf Angemessenheitsbeschlüsse (etwa das EU-US Data Privacy Framework für zertifizierte Anbieter) oder auf die Standardvertragsklauseln der Europäischen Kommission.',
        ],
      },
      {
        heading: '8. Wie lange wir Daten speichern',
        blocks: [
          {
            list: [
              'Daten auf deinem Gerät: bis du sie löschst oder deine Browserdaten löschst.',
              'Konto- und Cloud-Daten: bis du dein Konto löschst. Die Löschung entfernt sie sofort aus unserer Live-Datenbank; Kopien in verschlüsselten Sicherungen verfallen innerhalb von 30 Tagen.',
              'Fehlerberichte: bis zu 90 Tage.',
              'Nutzungsstatistiken: von Cloudflare nur als zusammengefasste Summen gespeichert, die dich nicht identifizieren.',
              'Sicherheitsprotokolle bei unserem Hosting-Anbieter: kurze Zeiträume, in der Regel Tage.',
              'Support-E-Mails: so lange wie für die Bearbeitung deiner Anfrage nötig, höchstens 2 Jahre.',
              'Abrechnungsunterlagen: von Lemon Squeezy so lange aufbewahrt, wie Steuer- und Buchhaltungsgesetze es verlangen.',
            ],
          },
        ],
      },
      {
        heading: '9. Deine Rechte und Wahlmöglichkeiten',
        blocks: [
          'Du hast das Recht auf Auskunft, Berichtigung, Export oder Löschung deiner personenbezogenen Daten, auf Widerspruch gegen bestimmte Verarbeitungen oder deren Einschränkung, auf jederzeitigen Widerruf einer Einwilligung und auf Datenübertragbarkeit.',
          {
            list: [
              'Daten auf diesem Gerät löschen: Einstellungen → „Alle Daten auf diesem Gerät löschen“.',
              'Konto und Cloud-Daten löschen: Konto → „Konto löschen“. Hast du ein aktives Abonnement, kündige es zuerst im Kundenportal.',
              'Auskunft und Übertragbarkeit: In den Einstellungen kann jeder alle seine Moneo-Daten kostenlos als JSON-Datei exportieren und auf einem anderen Gerät wieder importieren. Pro bietet zusätzliche Berichtsformate (CSV/PDF). Für jede andere Anfrage schreib an {email}.',
              'Beende die Cloud-Synchronisierung, indem du dich abmeldest; deine Daten bleiben auf deinem Gerät.',
            ],
          },
          'Wir beantworten Anfragen innerhalb eines Monats. Du kannst dich auch bei einer Datenschutzbehörde beschweren: in der Republik Moldau beim Nationalen Zentrum für den Schutz personenbezogener Daten; in der EU/im EWR bei der Behörde deines Wohnsitzlandes.',
        ],
      },
      {
        heading: '10. Cookies und lokaler Speicher',
        blocks: [
          'Moneo verwendet keine Werbe-Cookies, keine Werbe-Tracker, keine Tracking-Pixel und kein websiteübergreifendes Tracking. Für Nutzungsstatistiken setzen wir Cloudflare Web Analytics ein, das ohne Cookies arbeitet und nichts in deinem Browser speichert, um dich wiederzuerkennen. Wir nutzen den lokalen Speicher deines Browsers, um deine Daten und deine Anmeldesitzung zu speichern; das ist für den Betrieb der App unbedingt erforderlich. Cloudflare und Turnstile können unbedingt erforderliche Sicherheits-Cookies setzen, um Menschen von Bots zu unterscheiden. Der Checkout von Lemon Squeezy, der sich auf der eigenen Website von Lemon Squeezy öffnet, verwendet eigene Cookies.',
          'Schriften werden von unserer eigenen Domain geladen; wir laden weder Google Fonts noch andere Tracker Dritter.',
        ],
      },
      {
        heading: '11. Sicherheit',
        blocks: [
          'Daten werden über verschlüsselte Verbindungen (HTTPS/TLS) übertragen. Cloud-Daten sind durch Zugriffsregeln geschützt, sodass nur dein Konto sie lesen kann, und Datenbanksicherungen sind verschlüsselt. Moneo ist nicht Ende-zu-Ende-verschlüsselt, und kein System ist zu 100 % sicher; nutze daher bitte ein starkes, einzigartiges Passwort.',
        ],
      },
      {
        heading: '12. Kinder und Lernende',
        blocks: [
          `Moneo wird von Schülern, Studierenden und Erwachsenen genutzt. Für ein Konto gilt ein Mindestalter von ${MIN_ACCOUNT_AGE} Jahren. Nutzer unter ${ADULT_AGE} brauchen die Erlaubnis eines Elternteils oder Erziehungsberechtigten, und unterhalb des Alters der digitalen Einwilligung in ihrem Land (in vielen EU-Ländern ${DIGITAL_CONSENT_AGE}) muss ein Elternteil oder Erziehungsberechtigter der Kontoerstellung zustimmen.`,
          {
            list: [
              'Ohne Konto wird nichts an uns gesendet: Alle Daten bleiben auf dem Gerät. Das ist für jüngere Nutzer die sicherste Art, Moneo zu verwenden.',
              'Mit Konto erheben wir von Minderjährigen dieselben minimalen Daten wie von allen anderen (siehe Abschnitt 3) — nichts darüber hinaus.',
              'Keine Werbung, kein Profiling und kein Verkauf von Daten — für niemanden, auch nicht für Minderjährige.',
              'Eltern und Erziehungsberechtigte können per E-Mail an {email} verlangen, die Daten ihres Kindes einzusehen, zu exportieren oder zu löschen.',
              `Erfahren wir, dass ein Kind unter ${MIN_ACCOUNT_AGE} Jahren ein Konto erstellt hat, löschen wir das Konto und seine Daten.`,
            ],
          },
        ],
      },
      {
        heading: '13. Änderungen dieser Erklärung',
        blocks: [
          'Wir können diese Erklärung aktualisieren. Bei wesentlichen Änderungen informieren wir dich in der App oder per E-Mail. Das Datum „Zuletzt aktualisiert“ oben zeigt die aktuelle Fassung.',
        ],
      },
      {
        heading: '14. Kontakt',
        blocks: [`Für Datenschutzfragen oder -anfragen schreib an ${SELLER.name} unter {email}.`],
      },
    ],
  },

  refund: {
    title: 'Erstattungsrichtlinie',
    updated: UPDATED,
    intro: [
      `Wir möchten, dass du mit Moneo Pro zufrieden bist. Wenn nicht, bekommst du dein Geld innerhalb von ${REFUND_DAYS} Tagen zurück — ohne Fragen.`,
    ],
    sections: [
      {
        heading: `1. ${REFUND_DAYS}-Tage-Geld-zurück-Garantie`,
        blocks: [
          `Du kannst für jede Pro-Zahlung — deinen ersten Kauf oder eine Verlängerung, monatlich oder jährlich — innerhalb von ${REFUND_DAYS} Tagen ab dem Zahlungsdatum eine volle Erstattung verlangen. Einen Grund musst du nicht angeben.`,
        ],
      },
      {
        heading: '2. So beantragst du eine Erstattung',
        blocks: [
          {
            list: [
              'Schreib an {email} von der Adresse, die du beim Checkout verwendet hast, oder gib diese Adresse und deine Bestellnummer an (sie steht in deiner Beleg-E-Mail von Lemon Squeezy).',
              'Oder finde deine Bestellung in deiner Beleg-E-Mail von Lemon Squeezy oder unter {orders} und beantrage die Erstattung dort.',
            ],
          },
        ],
      },
      {
        heading: '3. Wer die Erstattung abwickelt',
        blocks: [
          `Zahlungen werden von ${MOR} abgewickelt, unserem Merchant of Record. Sobald wir deinen Antrag genehmigen, überweist ${MOR} das Geld einschließlich gezahlter Steuern auf deine ursprüngliche Zahlungsmethode zurück. Erstattungen erscheinen in der Regel innerhalb von 5–10 Werktagen, je nach Bank oder Kartenaussteller.`,
        ],
      },
      {
        heading: '4. Was nach einer Erstattung mit Pro passiert',
        blocks: [
          'Eine Erstattung kündigt auch das Abonnement, sodass keine weiteren Abbuchungen erfolgen. Die Pro-Funktionen enden mit der Bearbeitung der Erstattung, und dein Konto kehrt zum kostenlosen Plan zurück.',
          'Deine Daten werden nicht gelöscht: Alles auf deinem Gerät bleibt dort, und bereits mit deinem Konto synchronisierte Daten bleiben darin, bis du dein Konto löschst. Die vollständige Synchronisierung aller Daten ist eine Pro-Funktion und wird daher nicht mehr aktualisiert; Fokus-Sitzungen, Fokusbereiche und Einstellungen werden weiter synchronisiert.',
        ],
      },
      {
        heading: '5. Kündigen ist nicht dasselbe wie eine Erstattung',
        blocks: [
          {
            list: [
              'Kündigen: stoppt künftige Verlängerungen. Pro bleibt bis zum Ende des bereits bezahlten Zeitraums aktiv. Es wird kein Geld zurückgezahlt. Du kannst jederzeit im Kundenportal kündigen (Konto → Abo verwalten).',
              `Erstattung: zahlt das Geld für eine Zahlung der letzten ${REFUND_DAYS} Tage zurück und beendet Pro sofort.`,
            ],
          },
        ],
      },
      {
        heading: `6. Nach ${REFUND_DAYS} Tagen`,
        blocks: [
          `Nach ${REFUND_DAYS} Tagen sind Zahlungen grundsätzlich nicht erstattungsfähig, du kannst aber weiterhin jederzeit kündigen, um künftige Abbuchungen zu stoppen. Abrechnungsfehler wie eine doppelte Abbuchung korrigieren wir immer, und wir erstatten, wo das Gesetz es verlangt. Stellen wir das Pro-Angebot ein, erstatten wir den ungenutzten Teil eines im Voraus bezahlten Zeitraums.`,
          `Diese Richtlinie schränkt keine Rechte ein, die dir zwingendes Verbraucherrecht gewährt, einschließlich des EU-Widerrufsrechts, das diese ${REFUND_DAYS}-Tage-Garantie bereits abdeckt.`,
        ],
      },
      {
        heading: '7. Kontakt',
        blocks: [
          `Fragen zu Abrechnung oder Erstattungen? Schreib an {email}. Siehe auch unsere {terms}.`,
        ],
      },
    ],
  },
};

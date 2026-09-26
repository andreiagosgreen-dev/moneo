/**
 * Daily mottos — short attributed lines for the Mono life hub.
 * Stable rotation by calendar day key; bodies follow the UI locale.
 */
import type { Locale } from '../i18n/types';

export interface Motto {
  id: string;
  text: string;
  /** Short attribution shown next to the line. */
  source: string;
}

interface MottoDef {
  id: string;
  source: string;
  text: Record<Locale, string>;
}

const LOCALES: readonly Locale[] = ['en', 'ro', 'ru', 'uk', 'de', 'it', 'fr', 'es'];

function isLocale(v: string): v is Locale {
  return (LOCALES as readonly string[]).includes(v);
}

/** Accept `ro`, `ro-RO`, or undefined → Locale. */
export function resolveMottoLocale(localeOrTag?: string): Locale {
  if (!localeOrTag) return 'en';
  const raw = localeOrTag.trim().toLowerCase();
  if (isLocale(raw)) return raw;
  const base = raw.split(/[-_]/)[0];
  return isLocale(base) ? base : 'en';
}

/** Curated aforisms with localized bodies; sources stay as proper names. */
export const MOTTO_DEFS: readonly MottoDef[] = [
  {
    id: 'clear-1',
    source: 'James Clear',
    text: {
      en: 'You do not rise to the level of your goals. You fall to the level of your systems.',
      ro: 'Nu te ridici la nivelul obiectivelor. Cazi la nivelul sistemelor tale.',
      ru: 'Ты не поднимаешься до уровня целей. Ты падаешь до уровня своих систем.',
      uk: 'Ти не піднімаєшся до рівня цілей. Ти падаєш до рівня своїх систем.',
      de: 'Du steigst nicht auf das Niveau deiner Ziele. Du fällst auf das Niveau deiner Systeme.',
      it: 'Non sali al livello dei tuoi obiettivi. Cadi al livello dei tuoi sistemi.',
      fr: 'Tu ne t’élèves pas au niveau de tes objectifs. Tu tombes au niveau de tes systèmes.',
      es: 'No subes al nivel de tus metas. Caes al nivel de tus sistemas.',
    },
  },
  {
    id: 'clear-2',
    source: 'James Clear',
    text: {
      en: 'Every action you take is a vote for the person you wish to become.',
      ro: 'Fiecare acțiune e un vot pentru persoana care vrei să devii.',
      ru: 'Каждое действие — голос за человека, которым ты хочешь стать.',
      uk: 'Кожна дія — голос за людину, якою хочеш стати.',
      de: 'Jede Handlung ist eine Stimme für die Person, die du werden willst.',
      it: 'Ogni azione è un voto per la persona che vuoi diventare.',
      fr: 'Chaque action est un vote pour la personne que tu veux devenir.',
      es: 'Cada acción es un voto por la persona que quieres ser.',
    },
  },
  {
    id: 'covey-1',
    source: 'Stephen Covey',
    text: {
      en: 'Begin with the end in mind.',
      ro: 'Începe cu sfârșitul în minte.',
      ru: 'Начинай с конца в уме.',
      uk: 'Починай з кінця в розумі.',
      de: 'Beginne mit dem Ende vor Augen.',
      it: 'Inizia con la fine in mente.',
      fr: 'Commence avec la fin en tête.',
      es: 'Empieza con el fin en mente.',
    },
  },
  {
    id: 'covey-2',
    source: 'Stephen Covey',
    text: {
      en: 'The key is not to prioritize what’s on your schedule, but to schedule your priorities.',
      ro: 'Cheia nu e să prioritizezi ce e în program, ci să programezi prioritățile.',
      ru: 'Главное не ставить в приоритет расписание, а ставить приоритеты в расписание.',
      uk: 'Головне не пріоритезувати розклад, а ставити пріоритети в розклад.',
      de: 'Der Schlüssel ist nicht, den Kalender zu priorisieren, sondern Prioritäten zu terminieren.',
      it: 'La chiave non è dare priorità all’agenda, ma mettere in agenda le priorità.',
      fr: 'L’essentiel n’est pas de prioriser l’agenda, mais de mettre les priorités à l’agenda.',
      es: 'La clave no es priorizar la agenda, sino agendar las prioridades.',
    },
  },
  {
    id: 'drucker-1',
    source: 'Peter Drucker',
    text: {
      en: 'What gets measured gets managed.',
      ro: 'Ce se măsoară se gestionează.',
      ru: 'Что измеряется, тем управляют.',
      uk: 'Що вимірюється, тим керують.',
      de: 'Was gemessen wird, wird gesteuert.',
      it: 'Ciò che viene misurato viene gestito.',
      fr: 'Ce qui est mesuré est géré.',
      es: 'Lo que se mide se gestiona.',
    },
  },
  {
    id: 'drucker-2',
    source: 'Peter Drucker',
    text: {
      en: 'There is nothing so useless as doing efficiently that which should not be done at all.',
      ro: 'Nimic nu e mai inutil decât să faci eficient ceva ce n-ar trebui făcut deloc.',
      ru: 'Нет ничего бесполезнее, чем эффективно делать то, чего не следует делать вовсе.',
      uk: 'Немає нічого марнішого, ніж ефективно робити те, чого не варто робити взагалі.',
      de: 'Nichts ist nutzloser, als effizient zu tun, was gar nicht getan werden sollte.',
      it: 'Nulla è più inutile che fare in modo efficiente ciò che non andrebbe fatto affatto.',
      fr: 'Rien n’est plus inutile que de faire efficacement ce qui ne devrait pas être fait.',
      es: 'Nada es tan inútil como hacer con eficiencia lo que no debería hacerse.',
    },
  },
  {
    id: 'seneca-1',
    source: 'Seneca',
    text: {
      en: 'It is not that we have a short time to live, but that we waste a lot of it.',
      ro: 'Nu avem prea puțin timp de trăit — risipim prea mult din el.',
      ru: 'Не в том, что жизнь коротка, а в том, что мы многое в ней растрачиваем.',
      uk: 'Не в тому, що життя коротке, а в тому, що ми багато з нього марнуємо.',
      de: 'Nicht die Zeit ist kurz — wir verschwenden viel davon.',
      it: 'Non è che il tempo sia breve: ne sprechiamo troppo.',
      fr: 'Ce n’est pas que le temps soit court — nous en gaspillons beaucoup.',
      es: 'No es que el tiempo sea corto: desperdiciamos mucho.',
    },
  },
  {
    id: 'seneca-2',
    source: 'Seneca',
    text: {
      en: 'Luck is what happens when preparation meets opportunity.',
      ro: 'Norocul e ce se întâmplă când pregătirea întâlnește ocazia.',
      ru: 'Удача — это то, что случается, когда подготовка встречает возможность.',
      uk: 'Удача — це те, що трапляється, коли підготовка зустрічає нагоду.',
      de: 'Glück ist, was passiert, wenn Vorbereitung auf Gelegenheit trifft.',
      it: 'La fortuna è ciò che accade quando la preparazione incontra l’opportunità.',
      fr: 'La chance, c’est ce qui arrive quand la préparation rencontre l’occasion.',
      es: 'La suerte es lo que ocurre cuando la preparación encuentra la oportunidad.',
    },
  },
  {
    id: 'frankl-1',
    source: 'Viktor Frankl',
    text: {
      en: 'Between stimulus and response there is a space. In that space is our power to choose.',
      ro: 'Între stimul și răspuns e un spațiu. În acel spațiu e puterea noastră de a alege.',
      ru: 'Между стимулом и реакцией есть пространство. В нём — наша сила выбирать.',
      uk: 'Між стимулом і реакцією є простір. У ньому — наша сила обирати.',
      de: 'Zwischen Reiz und Reaktion liegt ein Raum. In ihm liegt unsere Wahlkraft.',
      it: 'Tra stimolo e risposta c’è uno spazio. In quello spazio c’è il nostro potere di scegliere.',
      fr: 'Entre stimulus et réponse, il y a un espace. Dans cet espace est notre pouvoir de choisir.',
      es: 'Entre estímulo y respuesta hay un espacio. En ese espacio está nuestro poder de elegir.',
    },
  },
  {
    id: 'angelou-1',
    source: 'Maya Angelou',
    text: {
      en: 'Do the best you can until you know better. Then when you know better, do better.',
      ro: 'Fă ce poți mai bine până știi mai bine. Când știi mai bine, fă mai bine.',
      ru: 'Делай лучшее, что можешь, пока не узнаешь больше. Узнав больше — делай лучше.',
      uk: 'Роби якнайкраще, доки не знатимеш більше. Коли знатимеш — роби краще.',
      de: 'Tu dein Bestes, bis du es besser weißt. Wenn du es besser weißt, tu es besser.',
      it: 'Fai del tuo meglio finché non sai di meglio. Quando sai di meglio, fai meglio.',
      fr: 'Fais de ton mieux jusqu’à savoir mieux. Quand tu sauras mieux, fais mieux.',
      es: 'Haz lo mejor que puedas hasta saber más. Cuando sepas más, hazlo mejor.',
    },
  },
  {
    id: 'roosevelt-1',
    source: 'Theodore Roosevelt',
    text: {
      en: 'Do what you can, with what you have, where you are.',
      ro: 'Fă ce poți, cu ce ai, de unde ești.',
      ru: 'Делай что можешь, с тем что есть, там где ты.',
      uk: 'Роби що можеш, з тим що маєш, там де ти є.',
      de: 'Tu, was du kannst, mit dem, was du hast, dort, wo du bist.',
      it: 'Fai ciò che puoi, con ciò che hai, dove sei.',
      fr: 'Fais ce que tu peux, avec ce que tu as, là où tu es.',
      es: 'Haz lo que puedas, con lo que tengas, donde estés.',
    },
  },
  {
    id: 'twain-1',
    source: 'Mark Twain',
    text: {
      en: 'The secret of getting ahead is getting started.',
      ro: 'Secretul progresului e să începi.',
      ru: 'Секрет продвижения вперёд — начать.',
      uk: 'Секрет поступу — почати.',
      de: 'Das Geheimnis des Vorankommens ist anzufangen.',
      it: 'Il segreto per andare avanti è cominciare.',
      fr: 'Le secret pour avancer, c’est de commencer.',
      es: 'El secreto de avanzar es empezar.',
    },
  },
  {
    id: 'lao-1',
    source: 'Lao Tzu',
    text: {
      en: 'A journey of a thousand miles begins with a single step.',
      ro: 'O călătorie de o mie de mile începe cu un singur pas.',
      ru: 'Путь в тысячу миль начинается с одного шага.',
      uk: 'Шлях у тисячу миль починається з одного кроку.',
      de: 'Eine Reise von tausend Meilen beginnt mit einem einzigen Schritt.',
      it: 'Un viaggio di mille miglia inizia con un solo passo.',
      fr: 'Un voyage de mille lieues commence par un seul pas.',
      es: 'Un viaje de mil millas empieza con un solo paso.',
    },
  },
  {
    id: 'einstein-1',
    source: 'Albert Einstein',
    text: {
      en: 'Strive not to be a success, but rather to be of value.',
      ro: 'Nu căuta să fii un succes — caută să fii de folos.',
      ru: 'Стремись не к успеху, а к тому, чтобы быть полезным.',
      uk: 'Прагни не до успіху, а до того, щоб бути корисним.',
      de: 'Strebe nicht nach Erfolg, sondern danach, von Wert zu sein.',
      it: 'Non sforzarti di avere successo: sforzati di essere di valore.',
      fr: 'Ne cherche pas le succès — cherche à être utile.',
      es: 'No busques el éxito: busca ser de valor.',
    },
  },
  {
    id: 'mandela-1',
    source: 'Nelson Mandela',
    text: {
      en: 'It always seems impossible until it is done.',
      ro: 'Mereu pare imposibil — până e făcut.',
      ru: 'Всегда кажется невозможным — пока не сделано.',
      uk: 'Завжди здається неможливим — доки не зроблено.',
      de: 'Es scheint immer unmöglich, bis es getan ist.',
      it: 'Sembra sempre impossibile, finché non è fatto.',
      fr: 'Cela semble toujours impossible, jusqu’à ce que ce soit fait.',
      es: 'Siempre parece imposible, hasta que se hace.',
    },
  },
  {
    id: 'plutarch-1',
    source: 'Plutarch',
    text: {
      en: 'What we achieve inwardly will change outer reality.',
      ro: 'Ce realizăm înăuntru va schimba realitatea din afară.',
      ru: 'То, чего мы достигаем внутри, изменит внешнюю реальность.',
      uk: 'Те, чого досягаємо всередині, змінить зовнішню реальність.',
      de: 'Was wir innen erreichen, verändert die äußere Wirklichkeit.',
      it: 'Ciò che realizziamo dentro cambierà la realtà fuori.',
      fr: 'Ce que nous accomplissons intérieurement changera la réalité extérieure.',
      es: 'Lo que logramos por dentro cambiará la realidad de fuera.',
    },
  },
];

/** Ids only — for tests / callers that need the catalog size. */
export const MOTTOS = MOTTO_DEFS.map((m) => ({ id: m.id, source: m.source }));

/** Deterministic hash of a day key → non-negative int. */
function dayHash(dateKey: string): number {
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) {
    h = (h * 31 + dateKey.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Motto for a calendar day. Same `dateKey` always returns the same motto id;
 * `text` follows the UI locale (`ro`, `en-US`, etc.).
 */
export function mottoForDay(dateKey: string, localeOrTag?: string): Motto {
  const list = MOTTO_DEFS;
  if (list.length === 0) {
    return { id: 'empty', text: '', source: '' };
  }
  const clean = typeof dateKey === 'string' && dateKey.length > 0 ? dateKey : '0';
  const def = list[dayHash(clean) % list.length];
  const locale = resolveMottoLocale(localeOrTag);
  return {
    id: def.id,
    source: def.source,
    text: def.text[locale] ?? def.text.en,
  };
}

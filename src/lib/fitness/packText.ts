/* Move module: "describe your workout" → pack choice, on the device (free).
 *
 * Plain keyword matching in the 8 app languages: zone, minutes, format,
 * level and equipment. Anything not mentioned keeps the current choice.
 * Pro can send the same text to the included AI for open-ended requests.
 */
import type { Equipment, FitLevel } from './library';
import { PACK_MINUTES, type PackChoice, type PackFormat, type PackZone } from './packs';

/** Lowercase, no accents (ș → s, é → e, й → и): patterns are matched the same way. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const ZONE_WORDS: [PackZone, string[]][] = [
  [
    'full',
    [
      'tot corpul',
      'full body',
      'whole body',
      'все тело',
      'всё тело',
      'усе тіло',
      'ganzkörper',
      'corps entier',
      'cuerpo completo',
      'total body',
      'corpo intero',
    ],
  ],
  [
    'mobility',
    [
      'stretch',
      'întinder',
      'mobilit',
      'yoga',
      'йог',
      'растяжк',
      'розтяжк',
      'dehn',
      'étirement',
      'estiramiento',
      'allungament',
      'flexib',
    ],
  ],
  [
    'cardio',
    [
      'cardio',
      'кардио',
      'кардіо',
      'hiit',
      'transpir',
      'sweat',
      'fat burn',
      'arder',
      'condition',
      'ausdauer',
      'endurance',
      'resistencia',
      'resistenza',
    ],
  ],
  [
    'core',
    [
      'abdom',
      'abs$',
      'core$',
      'пресс',
      'прес',
      'живот',
      'bauch',
      'abdos',
      'addom',
      'plank',
      'планк',
      'talie',
      'waist',
    ],
  ],
  [
    'glutes',
    [
      'fesier',
      'fund',
      'glute',
      'booty',
      'ягодиц',
      'сідниц',
      'po$',
      'gesäß',
      'fessier',
      'glúteo',
      'glutei',
    ],
  ],
  ['back', ['spate', 'back', 'спин', 'rücken', 'dos$', 'espalda', 'schiena', 'postur']],
  [
    'lower',
    [
      'picioar',
      'coaps',
      'legs$',
      'leg$',
      'quad',
      'squat',
      'genuflex',
      'ног',
      'бедр',
      'стегн',
      'присед',
      'bein',
      'jambe',
      'pierna',
      'gambe',
      'cosce',
    ],
  ],
  [
    'upper',
    [
      'braț',
      'mână',
      'mâini',
      'piept',
      'umer',
      'bicep',
      'tricep',
      'arms$',
      'arm$',
      'chest',
      'shoulder',
      'push-up',
      'pushup',
      'flotări',
      'рук',
      'груд',
      'плеч',
      'отжим',
      'віджим',
      'brust',
      'schulter',
      'liegestütz',
      'bras',
      'pector',
      'épaule',
      'pompe',
      'brazo',
      'pecho',
      'hombro',
      'flexion',
      'bracci',
      'petto',
      'spall',
      'piegament',
    ],
  ],
];

const FORMAT_WORDS: [PackFormat, string[]][] = [
  ['tabata', ['tabata', 'табата']],
  ['circuit', ['circuit', 'кругов', 'колов', 'zirkel', 'circuito', 'stații', 'станци', 'interval']],
  [
    'sets',
    [
      'seturi',
      'serii',
      'repetări',
      'sets$',
      'reps$',
      'подход',
      'підход',
      'повтор',
      'sätze',
      'wiederhol',
      'séries',
      'series',
      'répétition',
      'repeticion',
      'serie$',
      'ripetizion',
      'forță',
      'strength',
      'сил',
      'kraft',
      'force$',
      'fuerza',
      'forza',
    ],
  ],
];

const LEVEL_WORDS: [FitLevel, string[]][] = [
  [
    3,
    [
      'avansat',
      'greu',
      'intens',
      'advanced',
      'hard$',
      'продвинут',
      'сложн',
      'тяжел',
      'интенсив',
      'просунут',
      'важк',
      'інтенсив',
      'fortgeschritten',
      'schwer',
      'avancé',
      'difficile',
      'avanzad',
      'difícil',
      'avanzat',
    ],
  ],
  [
    2,
    [
      'mediu',
      'intermediar',
      'intermediate',
      'medium',
      'средн',
      'середн',
      'mittel',
      'intermédi',
      'intermedi',
      'medio$',
    ],
  ],
  [
    1,
    [
      'începător',
      'ușor',
      'beginner',
      'easy$',
      'light$',
      'новичок',
      'начина',
      'легк',
      'початків',
      'anfänger',
      'leicht',
      'débutant',
      'facile',
      'principiante',
      'fácil',
    ],
  ],
];

const GEAR_WORDS: [Equipment, string[]][] = [
  [
    'foamRoller',
    ['rulou', 'foam', 'massage roller', 'массажн', 'масажн', 'faszienroll', 'rouleau', 'rodillo'],
  ],
  ['abWheel', ['roată', 'roata', 'wheel', 'ролик', 'bauchroller', 'roue', 'rueda', 'ruota']],
  [
    'miniBand',
    [
      'mini band',
      'benzi mini',
      'banda mini',
      'bandă mini',
      'mini-band',
      'мини-резин',
      'мини резин',
      'міні-гум',
    ],
  ],
  ['band', ['bandă', 'banda', 'benzi', 'elastic', 'резинк', 'гумк', 'band', 'élastique']],
  [
    'dumbbell',
    ['gantere', 'ganter', 'dumbbell', 'гантел', 'hantel', 'haltère', 'mancuern', 'manubri'],
  ],
  ['kettlebell', ['kettlebell', 'kettle', 'гир']],
  [
    'pullupBar',
    [
      'bară',
      'tracțiun',
      'pull-up',
      'pullup',
      'турник',
      'перекладин',
      'klimmzug',
      'traction',
      'dominad',
      'trazion',
      'sbarra',
    ],
  ],
  ['pushupBars', ['mânere', 'push-up bar', 'упор', 'griffe', 'poignée', 'agarre', 'maniglie']],
  ['dipBars', ['paralele', 'dips', 'dip bar', 'брус', 'barren', 'parallel']],
  [
    'fitball',
    [
      'minge de fitness',
      'fitball',
      'фитбол',
      'фітбол',
      'gymnastikball',
      'swiss ball',
      'ballon de gym',
      'palla da ginnastica',
    ],
  ],
  [
    'medBall',
    [
      'minge medicinală',
      'medball',
      'медбол',
      'medizinball',
      'médecine',
      'medicinal',
      'palla medica',
      'slam ball',
    ],
  ],
  [
    'rope',
    ['coardă', 'coarda', 'sfoară', 'скакалк', 'jump rope', 'springseil', 'corde', 'comba', 'corda'],
  ],
  ['step', ['step', 'степ', 'platformă']],
  [
    'ankleWeights',
    ['glezn', 'ankle', 'утяжелител', 'обтяжувач', 'manschett', 'lest$', 'tobiller', 'caviglier'],
  ],
  [
    'suspension',
    ['trx', 'chingi', 'петл', 'schlingen', 'sangle', 'suspension', 'suspensi', 'sospension'],
  ],
  [
    'abBench',
    [
      'bancă de abdomene',
      'bancă abdomene',
      'скамь',
      'лава',
      'лаві',
      'bauchbank',
      'banc abdo',
      'banco de abdominales',
      'panca addominali',
    ],
  ],
];

const MINUTE_RE = /(\d{1,3})\s*-?\s*(?:min|мин|хв|minute|minut)/u;
const HOUR_RE = /(\d)\s*(?:h\b|ora|ore|hour|час|год|stunde|heure|hora)/u;
const LETTER = /\p{L}/u;

/**
 * Where `word` starts a word in `text` (so "ног" doesn't match "много"), or -1.
 * A trailing "$" also requires the word to end there ("core$" is not "corect").
 */
function findWord(text: string, word: string): number {
  const whole = word.endsWith('$');
  const w = fold(whole ? word.slice(0, -1) : word);
  for (let at = text.indexOf(w); at >= 0; at = text.indexOf(w, at + 1)) {
    const end = at + w.length;
    const startOk = at === 0 || !LETTER.test(text[at - 1]);
    const endOk = !whole || end >= text.length || !LETTER.test(text[end]);
    if (startOk && endOk) return at;
  }
  return -1;
}

function firstMatch<T>(text: string, table: [T, string[]][]): T | undefined {
  // Earliest mention wins, so "abs then back" picks abs.
  let best: { value: T; at: number } | undefined;
  for (const [value, words] of table) {
    for (const w of words) {
      const at = findWord(text, w);
      if (at >= 0 && (!best || at < best.at)) best = { value, at };
    }
  }
  return best?.value;
}

/** Nearest offered length (ties go to the longer one). */
export function nearestMinutes(n: number): number {
  return [...PACK_MINUTES].reduce((best, m) =>
    Math.abs(m - n) < Math.abs(best - n) || (Math.abs(m - n) === Math.abs(best - n) && m > best)
      ? m
      : best,
  );
}

export interface ParsedPack {
  choice: Partial<PackChoice>;
  /** Equipment the text mentions (used for this pack even if not in My equipment). */
  gear: Equipment[];
}

export function parsePackRequest(input: string): ParsedPack {
  const text = fold(input);
  const choice: Partial<PackChoice> = {};
  const zone = firstMatch(text, ZONE_WORDS);
  if (zone) choice.zone = zone;
  const format = firstMatch(text, FORMAT_WORDS);
  if (format) choice.format = format;
  const level = firstMatch(text, LEVEL_WORDS);
  if (level) choice.level = level;
  const min = MINUTE_RE.exec(text);
  const hours = HOUR_RE.exec(text);
  if (min) choice.minutes = nearestMinutes(Number(min[1]));
  else if (hours) choice.minutes = nearestMinutes(Number(hours[1]) * 60);
  const gear: Equipment[] = [];
  for (const [e, words] of GEAR_WORDS) {
    if (words.some((w) => findWord(text, w) >= 0)) gear.push(e);
  }
  const drop = (e: Equipment) => {
    const i = gear.indexOf(e);
    if (i >= 0) gear.splice(i, 1);
  };
  // "Massage roller" is a foam roller, not an ab wheel; "mini band" is not a long band.
  if (gear.includes('foamRoller')) drop('abWheel');
  if (gear.includes('miniBand')) drop('band');
  return { choice, gear };
}

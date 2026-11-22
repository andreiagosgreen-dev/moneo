import { useEffect, useState } from 'react';
import type { Locale, TKey, Vars } from '../lib/i18n/types';

type T = (key: TKey, vars?: Vars) => string;
type DemoTab = 'focus' | 'hud' | 'today' | 'habits' | 'fuel' | 'body';
type DemoMuscle = 'chest' | 'shoulders' | 'core' | 'legs' | 'back';

const DEMO_CIRC = 540.35;
const HUD_C1 = 2 * Math.PI * 82;
const HUD_C2 = 2 * Math.PI * 66;
const HUD_C3 = 2 * Math.PI * 50;
const DEMO_TICKS = Array.from({ length: 60 }, (_, i) => i * 6);
const DEMO_PRESETS = [5, 25, 45] as const;
const DEMO_WAVE = [0.3, 0.55, 0.8, 0.45, 0.95, 0.6, 1, 0.7, 0.4, 0.85, 0.65, 0.9, 0.5, 0.75, 0.35];

const INITIAL_HEATMAP = [
  true,
  true,
  false,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  false,
  true,
  true,
  true,
  false,
  true,
  true,
  true,
  true,
  true,
  false,
  true,
  true,
  true,
  true,
  true,
  true,
  false,
];

interface DemoLocaleCopy {
  fuelTab: string;
  bodyTab: string;
  cut: string;
  bulk: string;
  energy: string;
  swapHint: string;
  bodyHint: string;
  ready: string;
  recovering: string;
  muscles: Record<DemoMuscle, string>;
  meals: Record<
    'cut' | 'bulk' | 'energy',
    readonly [readonly string[], readonly string[], readonly string[]]
  >;
}

const DEMO_COPY: Record<Locale, DemoLocaleCopy> = {
  en: {
    fuelTab: 'Nutrition',
    bodyTab: 'Body',
    cut: 'Fat Loss',
    bulk: 'Muscle',
    energy: 'Focus',
    swapHint: 'Tap any ingredient to swap with an equal-macro analog',
    bodyHint: 'Tap a muscle zone to inspect its recovery curve',
    ready: 'Ready for full training',
    recovering: 'Recovering · ~14h to 100%',
    muscles: { chest: 'Chest', shoulders: 'Shoulders', core: 'Core', legs: 'Legs', back: 'Back' },
    meals: {
      cut: [
        [
          '3 Eggs + 100g Egg Whites',
          '200g Cottage Cheese 2%',
          '220g Greek Yogurt 2%',
          '180g Smoked Tofu',
        ],
        ['180g Grilled Chicken', '180g Turkey Breast', '190g Tuna in Water', '200g White Cod'],
        ['130g Cooked Buckwheat', '130g Basmati Rice', '180g Sweet Potato', '150g Boiled Lentils'],
      ],
      bulk: [
        ['3 Whole Eggs + 30g Whey', '250g Skyr + 2 Eggs', '220g Cottage + Whey', '4 Whole Eggs'],
        ['200g Lean Beef', '220g Chicken Thighs', '200g Baked Salmon', '220g Pork Tenderloin'],
        ['240g Jasmine Rice', '240g Wholegrain Pasta', '320g Baked Potatoes', '230g Quinoa'],
      ],
      energy: [
        ['250g Greek Yogurt 5%', '3 Poached Eggs', '220g Cottage Cheese', '180g Salmon + 1 Egg'],
        [
          '170g Salmon / Trout',
          '180g Chicken Breast',
          '170g Tuna + 1 Egg',
          '180g Turkey + Chickpeas',
        ],
        ['160g Quinoa / Buckwheat', '160g Basmati Rice', '200g Sweet Potato', '170g Red Lentils'],
      ],
    },
  },
  ro: {
    fuelTab: 'Alimentație',
    bodyTab: 'Corp',
    cut: 'Slăbire',
    bulk: 'Masă',
    energy: 'Energie',
    swapHint: 'Apasă pe orice ingredient pentru un înlocuitor echivalent',
    bodyHint: 'Apasă pe un mușchi pentru curba de recuperare 0–100%',
    ready: 'Odihnit · Gata de antrenament',
    recovering: 'În recuperare · ~14h până la 100%',
    muscles: {
      chest: 'Piept',
      shoulders: 'Umeri',
      core: 'Abdomen',
      legs: 'Picioare',
      back: 'Spate',
    },
    meals: {
      cut: [
        [
          '3 Ouă + 100g Albuș',
          '200g Brânză Cottage 2%',
          '220g Iaurt Grecesc 2%',
          '180g Tofu Afumat',
        ],
        ['180g Piept de Pui', '180g Piept de Curcan', '190g Ton în Suc Propriu', '200g Pește Alb'],
        ['130g Hrișcă Fiartă', '130g Orez Basmati', '180g Cartof Dulce', '150g Linte Fiartă'],
      ],
      bulk: [
        ['3 Ouă + 30g Whey', '250g Skyr + 2 Ouă', '220g Cottage + Whey', '4 Ouă Întregi'],
        ['200g Vită Slabă', '220g Pulpe de Pui', '200g Somon la Cuptor', '220g Mușchiuleț'],
        ['240g Orez Jasmine', '240g Paste Integrale', '320g Cartofi Copți', '230g Quinoa'],
      ],
      energy: [
        ['250g Iaurt Grecesc 5%', '3 Ouă Poșate', '220g Brânză Cottage', '180g Somon + 1 Ou'],
        ['170g Somon / Păstrăv', '180g Piept de Pui', '170g Ton + 1 Ou', '180g Curcan + Năut'],
        ['160g Quinoa / Hrișcă', '160g Orez Basmati', '200g Cartof Dulce', '170g Linte Roșie'],
      ],
    },
  },
  ru: {
    fuelTab: 'Питание',
    bodyTab: 'Тело',
    cut: 'Сушка',
    bulk: 'Масса',
    energy: 'Фокус',
    swapHint: 'Нажмите на продукт для замены по КБЖУ',
    bodyHint: 'Нажмите на мышцу для оценки восстановления 0–100%',
    ready: 'Восстановлена · Готова к тренировке',
    recovering: 'Восстанавливается · ~14ч до 100%',
    muscles: { chest: 'Грудь', shoulders: 'Плечи', core: 'Пресс', legs: 'Ноги', back: 'Спина' },
    meals: {
      cut: [
        ['3 яйца + 100г белка', '200г творога 2%', '220г греческого йогурта', '180г тофу'],
        ['180г куриной грудки', '180г индейки', '190г тунца в соку', '200г трески'],
        ['130г гречки', '130г риса басмати', '180г батата', '150г чечевицы'],
      ],
      bulk: [
        ['3 яйца + 30г протеина', '250г скира + 2 яйца', '220г творога + протеин', '4 яйца'],
        ['200г говядины', '220г куриного бедра', '200г лосося', '220г индейки'],
        ['240г риса жасмин', '240г пасты из тв. сортов', '320г картофеля', '230г киноа'],
      ],
      energy: [
        ['250г греческого йогурта', '3 яйца пашот', '220г творога', '180г лосося + яйцо'],
        ['170г лосося / форели', '180г куриной грудки', '170г тунца + яйцо', '180г индейки'],
        ['160г киноа / гречки', '160г риса басмати', '200г батата', '170г красной чечевицы'],
      ],
    },
  },
  uk: {
    fuelTab: 'Харчування',
    bodyTab: 'Тіло',
    cut: 'Схуднення',
    bulk: 'Маса',
    energy: 'Фокус',
    swapHint: 'Натисніть на продукт для рівноцінної заміни',
    bodyHint: 'Натисніть на м’яз для кривої відновлення 0–100%',
    ready: 'Відновлено · Готово до тренування',
    recovering: 'Відновлення · ~14 год до 100%',
    muscles: { chest: 'Груди', shoulders: 'Плечі', core: 'Прес', legs: 'Ноги', back: 'Спина' },
    meals: {
      cut: [
        ['3 яйця + 100г білка', '200г кисломолочного сиру', '220г грецького йогурту', '180г тофу'],
        ['180г курячого філе', '180г індички', '190г тунця у власному соку', '200г тріски'],
        ['130г гречки', '130г рису басматі', '180г батату', '150г сочевиці'],
      ],
      bulk: [
        ['3 яйця + 30г протеїну', '250г скіру + 2 яйця', '220г сиру + протеїн', '4 цілих яйця'],
        ['200г яловичини', '220г курячих стегон', '200г лосося', '220г індички'],
        ['240г рису жасмин', '240г цільнозернової пасти', '320г картоплі', '230г кіноа'],
      ],
      energy: [
        ['250г грецького йогурту', '3 яйця пашот', '220г сиру', '180г лосося + яйце'],
        ['170г лосося / форелі', '180г курячого філе', '170г тунця + яйце', '180г індички'],
        ['160г кіноа / гречки', '160г рису басматі', '200г батату', '170г червоної сочевиці'],
      ],
    },
  },
  de: {
    fuelTab: 'Ernährung',
    bodyTab: 'Körper',
    cut: 'Fettabbau',
    bulk: 'Muskelaufbau',
    energy: 'Fokus',
    swapHint: 'Tippe auf eine Zutat für eine makro-gleiche Alternative',
    bodyHint: 'Tippe auf eine Muskelgruppe für die 0–100% Erholung',
    ready: 'Erholt · Bereit für das Training',
    recovering: 'Regeneration · ~14h bis 100%',
    muscles: {
      chest: 'Brust',
      shoulders: 'Schultern',
      core: 'Rumpf',
      legs: 'Beine',
      back: 'Rücken',
    },
    meals: {
      cut: [
        [
          '3 Eier + 100g Eiklar',
          '200g Hüttenkäse 2%',
          '220g Griechischer Joghurt',
          '180g Räuchertofu',
        ],
        ['180g Hähnchenbrust', '180g Putenbrust', '190g Thunfisch im Saft', '200g Kabeljau'],
        ['130g Buchweizen', '130g Basmatireis', '180g Süßkartoffel', '150g Linsen'],
      ],
      bulk: [
        ['3 Eier + 30g Whey', '250g Skyr + 2 Eier', '220g Hüttenkäse + Whey', '4 Ganze Eier'],
        ['200g Mageres Rind', '220g Hähnchenkeule', '200g Lachsfilet', '220g Schweinefilet'],
        ['240g Jasminreis', '240g Vollkornpasta', '320g Ofenkartoffeln', '230g Quinoa'],
      ],
      energy: [
        ['250g Griechischer Joghurt', '3 Pochierte Eier', '220g Hüttenkäse', '180g Lachs + 1 Ei'],
        [
          '170g Lachs / Forelle',
          '180g Hähnchenbrust',
          '170g Thunfisch + 1 Ei',
          '180g Pute + Kichererbsen',
        ],
        ['160g Quinoa / Buchweizen', '160g Basmatireis', '200g Süßkartoffel', '170g Rote Linsen'],
      ],
    },
  },
  fr: {
    fuelTab: 'Nutrition',
    bodyTab: 'Corps',
    cut: 'Sèche',
    bulk: 'Masse',
    energy: 'Énergie',
    swapHint: 'Touchez un aliment pour un équivalent macro',
    bodyHint: 'Touchez un muscle pour voir sa récupération 0–100%',
    ready: 'Reposé · Prêt pour la séance',
    recovering: 'Récupération · ~14h avant 100%',
    muscles: {
      chest: 'Pectoraux',
      shoulders: 'Épaules',
      core: 'Abdos',
      legs: 'Jambes',
      back: 'Dos',
    },
    meals: {
      cut: [
        ['3 Œufs + 100g Blancs', '200g Cottage 2%', '220g Yaourt Grec 2%', '180g Tofu Fumé'],
        ['180g Blanc de Poulet', '180g Blanc de Dinde', '190g Thon au Naturel', '200g Cabillaud'],
        ['130g Sarrasin Cuit', '130g Riz Basmati', '180g Patate Douce', '150g Lentilles'],
      ],
      bulk: [
        ['3 Œufs + 30g Whey', '250g Skyr + 2 Œufs', '220g Cottage + Whey', '4 Œufs Entiers'],
        ['200g Bœuf Maigre', '220g Hauts de Poulet', '200g Saumon au Four', '220g Filet Mignon'],
        ['240g Riz Jasmin', '240g Pâtes Complètes', '320g Pommes de Terre', '230g Quinoa'],
      ],
      energy: [
        ['250g Yaourt Grec 5%', '3 Œufs Pochés', '220g Cottage', '180g Saumon + 1 Œuf'],
        [
          '170g Saumon / Truite',
          '180g Poulet Grillé',
          '170g Thon + 1 Œuf',
          '180g Dinde + Pois Chiches',
        ],
        [
          '160g Quinoa / Sarrasin',
          '160g Riz Basmati',
          '200g Patate Douce',
          '170g Lentilles Corail',
        ],
      ],
    },
  },
  it: {
    fuelTab: 'Nutrizione',
    bodyTab: 'Corpo',
    cut: 'Definizione',
    bulk: 'Massa',
    energy: 'Energia',
    swapHint: 'Tocca un alimento per un equivalente bilanciato',
    bodyHint: 'Tocca un muscolo per la curva di recupero 0–100%',
    ready: 'Pronto per allenamento completo',
    recovering: 'In recupero · ~14h al 100%',
    muscles: {
      chest: 'Petto',
      shoulders: 'Spalle',
      core: 'Addome',
      legs: 'Gambe',
      back: 'Schiena',
    },
    meals: {
      cut: [
        [
          '3 Uova + 100g Albumi',
          '200g Fiocchi di Latte',
          '220g Yogurt Greco 2%',
          '180g Tofu Affumicato',
        ],
        [
          '180g Petto di Pollo',
          '180g Petto di Tacchino',
          '190g Tonno al Naturale',
          '200g Merluzzo',
        ],
        ['130g Grano Saraceno', '130g Riso Basmati', '180g Patata Dolce', '150g Lenticchie'],
      ],
      bulk: [
        ['3 Uova + 30g Whey', '250g Skyr + 2 Uova', '220g Fiocchi + Whey', '4 Uova Intere'],
        ['200g Manzo Magro', '220g Cosce di Pollo', '200g Salmone al Forno', '220g Filetto'],
        ['240g Riso Jasmine', '240g Pasta Integrale', '320g Patate al Forno', '230g Quinoa'],
      ],
      energy: [
        [
          '250g Yogurt Greco 5%',
          '3 Uova in Camicia',
          '220g Fiocchi di Latte',
          '180g Salmone + 1 Uovo',
        ],
        [
          '170g Salmone / Trota',
          '180g Petto di Pollo',
          '170g Tonno + 1 Uovo',
          '180g Tacchino + Ceci',
        ],
        [
          '160g Quinoa / Saraceno',
          '160g Riso Basmati',
          '200g Patata Dolce',
          '170g Lenticchie Rosse',
        ],
      ],
    },
  },
  es: {
    fuelTab: 'Nutrición',
    bodyTab: 'Cuerpo',
    cut: 'Definición',
    bulk: 'Volumen',
    energy: 'Enfoque',
    swapHint: 'Toca cualquier ingrediente para cambiarlo por un equivalente',
    bodyHint: 'Toca un músculo para ver su recuperación 0–100%',
    ready: 'Listo para entrenar al 100%',
    recovering: 'Recuperando · ~14h para 100%',
    muscles: {
      chest: 'Pecho',
      shoulders: 'Hombros',
      core: 'Abdomen',
      legs: 'Piernas',
      back: 'Espalda',
    },
    meals: {
      cut: [
        [
          '3 Huevos + 100g Claras',
          '200g Queso Cottage 2%',
          '220g Yogur Griego 2%',
          '180g Tofu Ahumado',
        ],
        ['180g Pechuga de Pollo', '180g Pechuga de Pavo', '190g Atún al Natural', '200g Merluza'],
        ['130g Trigo Sarraceno', '130g Arroz Basmati', '180g Boniato', '150g Lentejas'],
      ],
      bulk: [
        ['3 Huevos + 30g Whey', '250g Skyr + 2 Huevos', '220g Cottage + Whey', '4 Huevos Enteros'],
        ['200g Ternera Magra', '220g Contramuslo Pollo', '200g Salmón al Horno', '220g Solomillo'],
        ['240g Arroz Jazmín', '240g Pasta Integral', '320g Patatas Asadas', '230g Quinoa'],
      ],
      energy: [
        ['250g Yogur Griego 5%', '3 Huevos Escalfados', '220g Cottage', '180g Salmón + 1 Huevo'],
        [
          '170g Salmón / Trucha',
          '180g Pechuga de Pollo',
          '170g Atún + 1 Huevo',
          '180g Pavo + Garbanzos',
        ],
        ['160g Quinoa / Sarraceno', '160g Arroz Basmati', '200g Boniato', '170g Lentejas Rojas'],
      ],
    },
  },
};

const MUSCLE_RECOVERY: Record<DemoMuscle, number> = {
  chest: 64,
  shoulders: 78,
  core: 94,
  legs: 100,
  back: 98,
};

function demoCopyFor(locale?: Locale): DemoLocaleCopy {
  return DEMO_COPY[locale ?? 'en'] ?? DEMO_COPY.en;
}

/**
 * Interactive, playable Hero Showcase for `/welcome`.
 * Zero external context dependencies so it never crashes on prerendered or public landing routes.
 */
export default function LiveHeroDemo({ t, locale = 'en' }: { t: T; locale?: Locale }) {
  const copy = demoCopyFor(locale);
  const [tab, setTab] = useState<DemoTab>('focus');
  const [minutes, setMinutes] = useState<number>(25);
  const [remaining, setRemaining] = useState<number>(25 * 60);
  const [running, setRunning] = useState(false);

  const [tasks, setTasks] = useState<Array<{ id: string; key: TKey; done: boolean; dur: string }>>([
    { id: '1', key: 'land.how.s1.t', done: true, dur: '25m' },
    { id: '2', key: 'land.how.s2.t', done: false, dur: '25m' },
    { id: '3', key: 'land.how.s3.t', done: false, dur: '15m' },
  ]);

  const [cells, setCells] = useState<boolean[]>(INITIAL_HEATMAP);
  const [fuelSwaps, setFuelSwaps] = useState<[number, number, number]>([0, 0, 0]);
  const [fuelGoal, setFuelGoal] = useState<'cut' | 'bulk' | 'energy'>('cut');
  const [pickedMuscle, setPickedMuscle] = useState<DemoMuscle>('legs');

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const total = minutes * 60;
  const ratio = total > 0 ? 1 - remaining / total : 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const angle = (1 - ratio) * 2 * Math.PI - Math.PI / 2;
  const bx = Number((100 + 86 * Math.cos(angle)).toFixed(2));
  const by = Number((100 + 86 * Math.sin(angle)).toFixed(2));

  const doneCount = tasks.filter((x) => x.done).length;
  const todayPct = Math.round((doneCount / tasks.length) * 100);
  const heatCount = cells.filter(Boolean).length;
  const heatPct = Math.round((heatCount / cells.length) * 100);
  const mindDemoPct = running ? Math.min(100, Math.max(68, Math.round(ratio * 100) + 68)) : 72;
  const hudScore = Math.round(mindDemoPct * 0.4 + todayPct * 0.35 + heatPct * 0.25);

  const pickMinutes = (m: number) => {
    setRunning(false);
    setMinutes(m);
    setRemaining(m * 60);
  };

  const pickedPct = MUSCLE_RECOVERY[pickedMuscle];

  return (
    <div className="lnd-live" aria-label="Moneo interactive preview">
      <div className="lnd-live-bar">
        <span className="lnd-live-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <div className="lnd-live-tabs" role="group" aria-label="Interactive preview switcher">
          {(['focus', 'today', 'hud', 'body', 'fuel', 'habits'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={tab === k}
              className={`lnd-live-tab${tab === k ? ' is-on' : ''}`}
              onClick={() => setTab(k)}
            >
              {k === 'hud'
                ? 'HUD'
                : k === 'fuel'
                  ? copy.fuelTab
                  : k === 'body'
                    ? copy.bodyTab
                    : t(`land.screen.${k}` as TKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="lnd-live-body">
        {tab === 'focus' && (
          <div className={`lnd-live-focus${running ? ' is-running' : ''}`}>
            <div className="lnd-live-dial">
              <div className="atm-aurora-orb" aria-hidden="true" />
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <defs>
                  <linearGradient id="lnd-dial-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="55%" stopColor="var(--mono-accent)" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                  <linearGradient id="lnd-reactor-grad" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.85" />
                  </linearGradient>
                </defs>
                <circle
                  className="atm-orbit-outer"
                  cx="100"
                  cy="100"
                  r="96"
                  fill="none"
                  strokeWidth="1"
                  strokeDasharray="6 10 2 10"
                />
                <g className="lnd-dial-ticks">
                  {DEMO_TICKS.map((deg) => (
                    <line
                      key={deg}
                      className={
                        deg % 90 === 0 ? 'is-cardinal' : deg % 30 === 0 ? 'is-major' : undefined
                      }
                      x1="100"
                      y1="5.5"
                      x2="100"
                      y2={deg % 90 === 0 ? '13' : deg % 30 === 0 ? '10' : '7.5'}
                      transform={`rotate(${deg} 100 100)`}
                    />
                  ))}
                </g>
                <circle className="lnd-dial-track" cx="100" cy="100" r="86" />
                <circle
                  className="lnd-dial-bar"
                  cx="100"
                  cy="100"
                  r="86"
                  stroke="url(#lnd-dial-grad)"
                  strokeDasharray={DEMO_CIRC}
                  strokeDashoffset={Number((DEMO_CIRC * ratio).toFixed(2))}
                  transform="rotate(-90 100 100)"
                />
                <circle
                  className="atm-orbit-mid"
                  cx="100"
                  cy="100"
                  r="72"
                  fill="none"
                  stroke="url(#lnd-reactor-grad)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeDasharray="42 18 14 18 64 22"
                />
                <circle
                  className="atm-orbit-inner"
                  cx="100"
                  cy="100"
                  r="61"
                  fill="none"
                  stroke="url(#lnd-dial-grad)"
                  strokeWidth="1.1"
                  strokeDasharray="16 12"
                />
                <circle className="lnd-dial-halo" cx={bx} cy={by} r="9" />
                <circle className="lnd-dial-dot" cx={bx} cy={by} r="4.2" />
              </svg>
              <div className="lnd-live-clock">
                <span className="lnd-live-time">
                  {mm}:{ss}
                </span>
                <div className={`atm-waveform${running ? ' is-live' : ''}`} aria-hidden="true">
                  {DEMO_WAVE.map((h, idx) => (
                    <span
                      key={idx}
                      style={{
                        height: `${Math.round(h * 15)}px`,
                        animationDelay: `${(idx * 80) % 640}ms`,
                      }}
                    />
                  ))}
                </div>
                <span className="lnd-live-pill">{minutes}m</span>
              </div>
            </div>

            <div className="lnd-live-presets">
              {DEMO_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`lnd-live-preset${minutes === m ? ' is-on' : ''}`}
                  onClick={() => pickMinutes(m)}
                >
                  {m}m
                </button>
              ))}
            </div>

            <button type="button" className="lnd-live-cta" onClick={() => setRunning((r) => !r)}>
              {running ? t('mono.focus.pause') : t('mono.focus.start')}
            </button>
          </div>
        )}

        {tab === 'today' && (
          <div className="lnd-live-today">
            <div className="lnd-live-today-head">
              <span className="lnd-live-today-title">{t('land.screen.today')}</span>
              <span className="lnd-live-today-pct">
                {doneCount}/{tasks.length} · {todayPct}%
              </span>
            </div>
            <div className="lnd-live-progress" aria-hidden="true">
              <span style={{ width: `${todayPct}%` }} />
            </div>
            <ul className="lnd-live-tasks">
              {tasks.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`lnd-live-task${item.done ? ' is-done' : ''}`}
                    onClick={() =>
                      setTasks((prev) =>
                        prev.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x)),
                      )
                    }
                  >
                    <span className="lnd-live-check" aria-hidden="true">
                      {item.done ? '✓' : ''}
                    </span>
                    <span className="lnd-live-task-txt">{t(item.key)}</span>
                    <span className="lnd-live-task-dur">{item.dur}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'habits' && (
          <div className="lnd-live-habits">
            <div className="lnd-live-today-head">
              <span className="lnd-live-today-title">{t('land.screen.habits')}</span>
              <span className="lnd-live-today-pct">{heatPct}%</span>
            </div>
            <div className="lnd-live-heat">
              {cells.map((on, i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  aria-label={`Day ${i + 1}`}
                  className={`lnd-live-cell${on ? ' is-on' : ''}`}
                  onClick={() => setCells((prev) => prev.map((v, idx) => (idx === i ? !v : v)))}
                />
              ))}
            </div>
          </div>
        )}

        {tab === 'hud' && (
          <div className="lnd-live-hud">
            <div className="lnd-live-hud-dial">
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <circle className="lnd-dial-track" cx="100" cy="100" r="82" />
                <circle
                  className="lnd-dial-bar"
                  cx="100"
                  cy="100"
                  r="82"
                  stroke="var(--mono-accent)"
                  strokeDasharray={HUD_C1}
                  strokeDashoffset={Number((HUD_C1 * (1 - mindDemoPct / 100)).toFixed(2))}
                  transform="rotate(-90 100 100)"
                />
                <circle className="lnd-dial-track" cx="100" cy="100" r="66" />
                <circle
                  className="lnd-dial-bar"
                  cx="100"
                  cy="100"
                  r="66"
                  stroke="#38bdf8"
                  strokeDasharray={HUD_C2}
                  strokeDashoffset={Number(
                    (HUD_C2 * (1 - Math.max(0.08, todayPct / 100))).toFixed(2),
                  )}
                  transform="rotate(-90 100 100)"
                />
                <circle className="lnd-dial-track" cx="100" cy="100" r="50" />
                <circle
                  className="lnd-dial-bar"
                  cx="100"
                  cy="100"
                  r="50"
                  stroke="#34d399"
                  strokeDasharray={HUD_C3}
                  strokeDashoffset={Number(
                    (HUD_C3 * (1 - Math.max(0.08, heatPct / 100))).toFixed(2),
                  )}
                  transform="rotate(-90 100 100)"
                />
              </svg>
              <div className="lnd-live-clock">
                <span className="lnd-live-time">{hudScore}</span>
                <span className="lnd-live-pill">SCORE</span>
              </div>
            </div>
            <div className="lnd-live-hud-bars">
              <div className="lnd-hud-row">
                <span className="lnd-hud-dot is-mind" />
                <span>{t('land.screen.focus')}</span>
                <strong>{mindDemoPct}%</strong>
              </div>
              <div className="lnd-hud-row">
                <span className="lnd-hud-dot is-exec" />
                <span>{t('land.screen.today')}</span>
                <strong>{todayPct}%</strong>
              </div>
              <div className="lnd-hud-row">
                <span className="lnd-hud-dot is-body" />
                <span>{t('land.screen.habits')}</span>
                <strong>{heatPct}%</strong>
              </div>
            </div>
          </div>
        )}

        {tab === 'fuel' && (
          <div className="lnd-live-today">
            <p className="lnd-demo-hint">{copy.swapHint}</p>
            <div className="lnd-demo-pills">
              {(
                [
                  ['cut', copy.cut],
                  ['bulk', copy.bulk],
                  ['energy', copy.energy],
                ] as const
              ).map(([g, lbl]) => (
                <button
                  key={g}
                  type="button"
                  className={`lnd-demo-pill${fuelGoal === g ? ' is-on' : ''}`}
                  onClick={() => setFuelGoal(g)}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <div className="lnd-demo-list">
              {[0, 1, 2].map((i) => {
                const list = copy.meals[fuelGoal][i];
                const idx = fuelSwaps[i];
                return (
                  <button
                    key={i}
                    type="button"
                    className="lnd-demo-swap-row"
                    onClick={() =>
                      setFuelSwaps(
                        (prev) =>
                          prev.map((v, j) => (j === i ? (v + 1) % 4 : v)) as [
                            number,
                            number,
                            number,
                          ],
                      )
                    }
                  >
                    <span>{list[idx]}</span>
                    <span className="lnd-demo-swap-badge">⇄ {idx + 1}/4</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'body' && (
          <div className="lnd-live-body-scan">
            <p className="lnd-demo-hint">{copy.bodyHint}</p>
            <div className="lnd-demo-body-wrap">
              <svg
                className="lnd-demo-body-svg"
                viewBox="0 0 180 230"
                role="img"
                aria-label={copy.bodyTab}
              >
                {/* Minimal biometric silhouette */}
                <circle cx="90" cy="24" r="14" className="lnd-bzone-base" />
                <rect x="83" y="38" width="14" height="10" rx="4" className="lnd-bzone-base" />
                {/* Shoulders */}
                <g
                  className={`lnd-bzone${pickedMuscle === 'shoulders' ? ' is-sel' : ''}`}
                  onClick={() => setPickedMuscle('shoulders')}
                >
                  <ellipse cx="56" cy="59" rx="13" ry="11" />
                  <ellipse cx="124" cy="59" rx="13" ry="11" />
                </g>
                {/* Chest */}
                <path
                  d="M66 52 H114 L110 82 Q90 88 70 82 Z"
                  className={`lnd-bzone is-amber${pickedMuscle === 'chest' ? ' is-sel' : ''}`}
                  onClick={() => setPickedMuscle('chest')}
                />
                {/* Core */}
                <rect
                  x="73"
                  y="86"
                  width="34"
                  height="38"
                  rx="8"
                  className={`lnd-bzone is-fresh${pickedMuscle === 'core' ? ' is-sel' : ''}`}
                  onClick={() => setPickedMuscle('core')}
                />
                {/* Arms */}
                <rect x="44" y="72" width="14" height="48" rx="7" className="lnd-bzone-base" />
                <rect x="122" y="72" width="14" height="48" rx="7" className="lnd-bzone-base" />
                {/* Back wings indicator */}
                <g
                  className={`lnd-bzone is-fresh${pickedMuscle === 'back' ? ' is-sel' : ''}`}
                  onClick={() => setPickedMuscle('back')}
                >
                  <path d="M62 72 L71 84 L69 102 L61 90 Z" />
                  <path d="M118 72 L109 84 L111 102 L119 90 Z" />
                </g>
                {/* Legs */}
                <g
                  className={`lnd-bzone is-fresh${pickedMuscle === 'legs' ? ' is-sel' : ''}`}
                  onClick={() => setPickedMuscle('legs')}
                >
                  <rect x="68" y="128" width="19" height="86" rx="9" />
                  <rect x="93" y="128" width="19" height="86" rx="9" />
                </g>
              </svg>

              <div className="lnd-demo-body-info">
                <div className="lnd-demo-pills">
                  {(['legs', 'back', 'core', 'shoulders', 'chest'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`lnd-demo-pill${pickedMuscle === m ? ' is-on' : ''}`}
                      onClick={() => setPickedMuscle(m)}
                    >
                      {copy.muscles[m]} · {MUSCLE_RECOVERY[m]}%
                    </button>
                  ))}
                </div>
                <div className="lnd-demo-body-readout">
                  <strong>
                    {copy.muscles[pickedMuscle]} — {pickedPct}%
                  </strong>
                  <span>{pickedPct >= 85 ? copy.ready : copy.recovering}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

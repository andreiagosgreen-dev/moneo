import type { Locale } from './i18n/types';
import type { Session } from './store';
import { getExercise, type Muscle } from './fitness/library';
import type { WorkoutEntry } from './fitness/workouts';
import { safeRead, safeWrite } from './storage/storageAdapter';

const STORAGE_FUEL_KEY = 'moneo:fuel-state';

export type NutritionGoal = 'cut' | 'bulk' | 'energy' | 'balance';
export type MealSlot = 'morning' | 'lunch' | 'dinner';

export interface IngredientGroup {
  id: string;
  /** Index 0 is default; tapping Swap cycles through equivalents with matching macros. */
  options: Record<Locale, readonly [string, string, string, string]>;
}

export interface MealTemplate {
  id: string;
  slot: MealSlot;
  goal: NutritionGoal;
  prepMin: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  title: Record<Locale, string>;
  ingredients: readonly IngredientGroup[];
}

export interface FuelDayState {
  goal: NutritionGoal;
  /** Keyed by `${dayKey}:${slot}` → true when logged. */
  eaten: Record<string, boolean>;
  /** Keyed by `${mealId}:${ingredientId}` → selected analog index (0..3). */
  swaps: Record<string, number>;
  /** Keyed by `${dayKey}:2min` → true when Atomic 2-Minute Rescue was used today. */
  twoMinDone?: Record<string, boolean>;
  /** Keyed by `${dayKey}:act:${0|1|2}` → individual 2-minute micro-actions checked today. */
  twoMinChecks?: Record<string, boolean>;
  identityId?: 'builder' | 'athlete' | 'performer';
}

const DEFAULT_FUEL_STATE: FuelDayState = {
  goal: 'energy',
  eaten: {},
  swaps: {},
  twoMinDone: {},
  twoMinChecks: {},
  identityId: 'builder',
};

export function loadFuelState(): FuelDayState {
  const raw = safeRead<Partial<FuelDayState>>(STORAGE_FUEL_KEY);
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_FUEL_STATE };
  const goal: NutritionGoal =
    raw.goal === 'cut' || raw.goal === 'bulk' || raw.goal === 'energy' || raw.goal === 'balance'
      ? raw.goal
      : 'energy';
  const identityId =
    raw.identityId === 'builder' || raw.identityId === 'athlete' || raw.identityId === 'performer'
      ? raw.identityId
      : 'builder';
  return {
    goal,
    eaten: raw.eaten && typeof raw.eaten === 'object' ? raw.eaten : {},
    swaps: raw.swaps && typeof raw.swaps === 'object' ? raw.swaps : {},
    twoMinDone: raw.twoMinDone && typeof raw.twoMinDone === 'object' ? raw.twoMinDone : {},
    twoMinChecks: raw.twoMinChecks && typeof raw.twoMinChecks === 'object' ? raw.twoMinChecks : {},
    identityId,
  };
}

export function saveFuelState(state: FuelDayState): boolean {
  return safeWrite(STORAGE_FUEL_KEY, state);
}

/** Helper to broadcast a 4-option tuple across all 8 locales with localized overrides. */
function opts(
  en: readonly [string, string, string, string],
  ro: readonly [string, string, string, string],
  ru: readonly [string, string, string, string] = en,
): Record<Locale, readonly [string, string, string, string]> {
  return { en, ro, ru, uk: ru, de: en, it: en, fr: en, es: en };
}

function titles(en: string, ro: string, ru: string = en): Record<Locale, string> {
  return { en, ro, ru, uk: ru, de: en, it: en, fr: en, es: en };
}

export const MEAL_TEMPLATES: readonly MealTemplate[] = [
  // MORNING
  {
    id: 'm-cut',
    slot: 'morning',
    goal: 'cut',
    prepMin: 6,
    kcal: 390,
    proteinG: 36,
    carbsG: 24,
    fatG: 16,
    title: titles(
      'High-Protein Metabolic Omelet',
      'Omletă Metabolică High-Protein',
      'Белковый омлет',
    ),
    ingredients: [
      {
        id: 'prot',
        options: opts(
          [
            '3 Eggs + 100g Egg Whites',
            '200g Cottage Cheese 2%',
            '220g Greek Yogurt 2% + Whey',
            '180g Smoked Tofu + Hemp Seeds',
          ],
          [
            '3 Ouă + 100g Albuș',
            '200g Brânză Cottage 2%',
            '220g Iaurt Grecesc 2% + Whey',
            '180g Tofu Afumat + Semințe Cânepă',
          ],
          ['3 яйца + 100г белка', '200г творога 2%', '220г греческого йогурта', '180г тофу'],
        ),
      },
      {
        id: 'carb',
        options: opts(
          ['1 Slice Sourdough Rye', '40g Rolled Oats', '100g Berries', '1 Medium Apple'],
          [
            '1 Felie Pâine Secară cu Maia',
            '40g Fulgi de Ovăz',
            '100g Fructe de Pădure',
            '1 Măr Mediu',
          ],
        ),
      },
      {
        id: 'fat',
        options: opts(
          [
            '1/2 Avocado + Spinach',
            '10g Olive Oil + Tomatoes',
            '15g Walnuts + Cucumber',
            '20g Feta + Rucola',
          ],
          [
            '1/2 Avocado + Spanac',
            '10g Ulei Măsline + Roșii',
            '15g Nuci + Castravete',
            '20g Telemea/Feta + Rucola',
          ],
        ),
      },
    ],
  },
  {
    id: 'm-bulk',
    slot: 'morning',
    goal: 'bulk',
    prepMin: 7,
    kcal: 680,
    proteinG: 44,
    carbsG: 76,
    fatG: 22,
    title: titles(
      'Anabolic Power Oats & Eggs',
      'Ovăz Anabolic & Ouă pentru Masă',
      'Овсянка и яйца для массы',
    ),
    ingredients: [
      {
        id: 'prot',
        options: opts(
          [
            '3 Whole Eggs + 30g Whey',
            '250g Skyr / Greek Yogurt + 2 Eggs',
            '220g Cottage Cheese + 30g Whey',
            '4 Whole Eggs',
          ],
          [
            '3 Ouă Întregi + 30g Whey',
            '250g Skyr / Iaurt Grecesc + 2 Ouă',
            '220g Brânză Cottage + 30g Whey',
            '4 Ouă Întregi',
          ],
        ),
      },
      {
        id: 'carb',
        options: opts(
          [
            '85g Oats + 1 Banana',
            '2 Slices Sourdough + Honey',
            '80g Buckwheat Flakes + Dates',
            '90g Rice Cream + Berries',
          ],
          [
            '85g Ovăz + 1 Banană',
            '2 Felii Pâine cu Maia + Miere',
            '80g Fulgi Hrișcă + Curmale',
            '90g Cremă de Orez + Fructe',
          ],
        ),
      },
      {
        id: 'fat',
        options: opts(
          [
            '25g Peanut Butter',
            '25g Almonds / Cashews',
            '20g Dark Chocolate 85% + Walnuts',
            '15g Butter + Chia Seeds',
          ],
          [
            '25g Unt de Arahide',
            '25g Migdale / Caju',
            '20g Ciocolată Neagră 85% + Nuci',
            '15g Unt + Semințe Chia',
          ],
        ),
      },
    ],
  },
  {
    id: 'm-energy',
    slot: 'morning',
    goal: 'energy',
    prepMin: 5,
    kcal: 490,
    proteinG: 34,
    carbsG: 42,
    fatG: 20,
    title: titles(
      'Neuro-Focus Morning Bowl',
      'Bol Neuro-Focus fără Cădere Glicemică',
      'Нейро-завтрак для фокуса',
    ),
    ingredients: [
      {
        id: 'prot',
        options: opts(
          [
            '250g Greek Yogurt 5%',
            '3 Poached Eggs',
            '220g Cottage Cheese',
            '180g Smoked Salmon + 1 Egg',
          ],
          [
            '250g Iaurt Grecesc 5%',
            '3 Ouă Poșate',
            '220g Brânză Cottage',
            '180g Somon Afumat + 1 Ou',
          ],
        ),
      },
      {
        id: 'carb',
        options: opts(
          [
            '50g Oats + Blueberries',
            '60g Buckwheat + Green Apple',
            '1 Slice Rye Toast + Kiwi',
            '50g Quinoa Flakes + Berries',
          ],
          [
            '50g Ovăz + Afine',
            '60g Hrișcă + Măr Verde',
            '1 Felie Pâine Secară + Kiwi',
            '50g Fulgi Quinoa + Fructe Pădure',
          ],
        ),
      },
      {
        id: 'fat',
        options: opts(
          [
            '20g Walnuts + Cinnamon',
            '15g Pumpkin Seeds + Flax',
            '1/2 Avocado + Lemon',
            '18g Almonds + Cacao Nibs',
          ],
          [
            '20g Nuci + Scorțișoară',
            '15g Semințe Dovleac + In',
            '1/2 Avocado + Lămâie',
            '18g Migdale + Cacao',
          ],
        ),
      },
    ],
  },
  // LUNCH
  {
    id: 'l-cut',
    slot: 'lunch',
    goal: 'cut',
    prepMin: 10,
    kcal: 470,
    proteinG: 46,
    carbsG: 38,
    fatG: 14,
    title: titles(
      'Lean Grill & Smart Carbs Plate',
      'Farfurie Lean Grill & Carbohidrați Lenti',
      'Лёгкий обед для сушки',
    ),
    ingredients: [
      {
        id: 'prot',
        options: opts(
          [
            '180g Chicken Breast',
            '180g Turkey Breast',
            '190g Canned Tuna (in water)',
            '200g White Fish / Cod',
          ],
          [
            '180g Piept de Pui la Grătar',
            '180g Piept de Curcan',
            '190g Ton în Suc Propriu',
            '200g Pește Alb / Șalău',
          ],
        ),
      },
      {
        id: 'carb',
        options: opts(
          [
            '130g Cooked Buckwheat',
            '130g Basmati / Brown Rice',
            '180g Baked Sweet Potato',
            '150g Cooked Lentils',
          ],
          [
            '130g Hrișcă Fiartă',
            '130g Orez Basmati / Brun',
            '180g Cartof Dulce Copt',
            '150g Linte Fiartă',
          ],
        ),
      },
      {
        id: 'fat',
        options: opts(
          [
            'Big Green Salad + 10g Olive Oil',
            'Steamed Broccoli + 1/3 Avocado',
            'Roasted Zucchini + 12g Pumpkin Seeds',
            'Cabbage Salad + Lemon & Olive Oil',
          ],
          [
            'Salată Verde Mare + 10g Ulei Măsline',
            'Broccoli + 1/3 Avocado',
            'Dovlecei la Tigaie + 12g Semințe',
            'Salată de Varză + Lămâie & Ulei',
          ],
        ),
      },
    ],
  },
  {
    id: 'l-bulk',
    slot: 'lunch',
    goal: 'bulk',
    prepMin: 12,
    kcal: 790,
    proteinG: 52,
    carbsG: 92,
    fatG: 23,
    title: titles('Hypertrophy Power Bowl', 'Bol de Forță & Hipertrofie', 'Обед для роста мышц'),
    ingredients: [
      {
        id: 'prot',
        options: opts(
          [
            '200g Beef Steak / Lean Mince',
            '220g Chicken Thighs / Breast',
            '200g Salmon Fillet',
            '220g Pork Tenderloin',
          ],
          [
            '200g Vită Слаbă / Antricot',
            '220g Pulpe / Piept de Pui',
            '200g File de Somon',
            '220g Mușchiuleț de Porc',
          ],
        ),
      },
      {
        id: 'carb',
        options: opts(
          [
            '240g Cooked Jasmine Rice',
            '240g Whole-Wheat Pasta',
            '320g Baked Potatoes',
            '230g Cooked Buckwheat / Quinoa',
          ],
          [
            '240g Orez Jasmine Fiert',
            '240g Paste Integrale',
            '320g Cartofi Copți',
            '230g Hrișcă / Quinoa Fiartă',
          ],
        ),
      },
      {
        id: 'fat',
        options: opts(
          [
            '15g Olive Oil + Grilled Veggies',
            '1/2 Avocado + Tomatoes',
            '25g Parmesan + Rucola',
            '20g Hummus + Peppers',
          ],
          [
            '15g Ulei Măsline + Legume',
            '1/2 Avocado + Roșii',
            '25g Parmezan + Rucola',
            '20g Hummus + Ardei',
          ],
        ),
      },
    ],
  },
  {
    id: 'l-energy',
    slot: 'lunch',
    goal: 'energy',
    prepMin: 10,
    kcal: 580,
    proteinG: 44,
    carbsG: 54,
    fatG: 20,
    title: titles(
      'Mediterranean Brain-Fuel Bowl',
      'Bol Mediteranean anti-somnolență',
      'Средиземноморский боул',
    ),
    ingredients: [
      {
        id: 'prot',
        options: opts(
          [
            '170g Salmon / Trout',
            '180g Chicken Breast',
            '170g Tuna + 1 Boiled Egg',
            '180g Turkey + Chickpeas',
          ],
          [
            '170g Somon / Păstrăv',
            '180g Piept de Pui',
            '170g Ton + 1 Ou Fiert',
            '180g Curcan + Năut',
          ],
        ),
      },
      {
        id: 'carb',
        options: opts(
          [
            '160g Quinoa / Buckwheat',
            '160g Basmati Rice',
            '200g Sweet Potato',
            '170g Red Lentils / Bulghur',
          ],
          [
            '160g Quinoa / Hrișcă',
            '160g Orez Basmati',
            '200g Cartof Dulce',
            '170g Linte Roșie / Bulgur',
          ],
        ),
      },
      {
        id: 'fat',
        options: opts(
          [
            '12g Extra-Virgin Olive Oil + Greens',
            '1/2 Avocado + Cucumber',
            '30g Olives + Feta',
            '15g Tahini / Sesame Dressing',
          ],
          [
            '12g Ulei Măsline Extravirgin + Salată',
            '1/2 Avocado + Castravete',
            '30g Măsline + Brânză Feta',
            '15g Sos Tahini / Susan',
          ],
        ),
      },
    ],
  },
  // DINNER
  {
    id: 'd-cut',
    slot: 'dinner',
    goal: 'cut',
    prepMin: 8,
    kcal: 360,
    proteinG: 40,
    carbsG: 14,
    fatG: 15,
    title: titles(
      'Light Recovery & Deep Sleep Dinner',
      'Cină Ușoară pentru Ardere & Somn Profund',
      'Лёгкий ужин',
    ),
    ingredients: [
      {
        id: 'prot',
        options: opts(
          [
            '180g White Fish / Trout',
            '170g Chicken / Turkey Breast',
            '220g Cottage Cheese 2%',
            '3 Eggs + Egg Whites Scramble',
          ],
          [
            '180g Pește Alb / Păstrăv',
            '170g Piept de Pui / Curcan',
            '220g Brânză Cottage 2%',
            '3 Ouă + Albușuri la Tigaie',
          ],
        ),
      },
      {
        id: 'carb',
        options: opts(
          [
            '250g Roasted Broccoli & Cauliflower',
            '250g Asparagus & Zucchini',
            'Large Mixed Salad + Tomatoes',
            '250g Green Beans & Mushrooms',
          ],
          [
            '250g Broccoli & Conopidă la Cuptor',
            '250g Sparanghel & Dovlecei',
            'Salată Asortată Mare + Roșii',
            '250g Fasole Verde & Ciuperci',
          ],
        ),
      },
      {
        id: 'fat',
        options: opts(
          ['10g Olive Oil + Herbs', '1/3 Avocado', '12g Pumpkin Seeds', '15g Mozzarella Light'],
          [
            '10g Ulei de Măsline + Ierburi',
            '1/3 Avocado',
            '12g Semințe de Dovleac',
            '15g Mozzarella Light',
          ],
        ),
      },
    ],
  },
  {
    id: 'd-bulk',
    slot: 'dinner',
    goal: 'bulk',
    prepMin: 10,
    kcal: 670,
    proteinG: 48,
    carbsG: 68,
    fatG: 22,
    title: titles(
      'Overnight Muscle Repair Dinner',
      'Cină pentru Refacere Musculară Nocturnă',
      'Ужин для восстановления',
    ),
    ingredients: [
      {
        id: 'prot',
        options: opts(
          [
            '190g Salmon / Beef',
            '200g Chicken + 100g Cottage Cheese',
            '200g Turkey + 2 Eggs',
            '250g Quark / Cottage + Whey',
          ],
          [
            '190g Somon / Vită',
            '200g Pui + 100g Brânză Cottage',
            '200g Curcan + 2 Ouă',
            '250g Brânză Cottage + Whey',
          ],
        ),
      },
      {
        id: 'carb',
        options: opts(
          [
            '200g Baked Potato / Sweet Potato',
            '180g Cooked Rice',
            '180g Buckwheat',
            '2 Slices Sourdough Bread',
          ],
          ['200g Cartof Copt / Dulce', '180g Orez Fiert', '180g Hrișcă', '2 Felii Pâine cu Maia'],
        ),
      },
      {
        id: 'fat',
        options: opts(
          ['15g Olive Oil + Salad', '1/2 Avocado', '20g Walnuts / Almonds', '15g Butter + Greens'],
          ['15g Ulei Măsline + Salată', '1/2 Avocado', '20g Nuci / Migdale', '15g Unt + Verdețuri'],
        ),
      },
    ],
  },
  {
    id: 'd-energy',
    slot: 'dinner',
    goal: 'energy',
    prepMin: 8,
    kcal: 460,
    proteinG: 38,
    carbsG: 32,
    fatG: 18,
    title: titles(
      'Serotonin & Recovery Evening Plate',
      'Cină de Recuperare & Somn Odihnitor',
      'Вечерний рацион',
    ),
    ingredients: [
      {
        id: 'prot',
        options: opts(
          [
            '170g Turkey / Chicken Breast',
            '170g Baked Trout / Salmon',
            '200g Cottage Cheese + 1 Egg',
            '180g Tofu / Halloumi Grill',
          ],
          [
            '170g Piept de Curcan / Pui',
            '170g Păstrăv / Somon la Cuptor',
            '200g Brânză Cottage + 1 Ou',
            '180g Tofu / Halloumi la Grătar',
          ],
        ),
      },
      {
        id: 'carb',
        options: opts(
          [
            '140g Sweet Potato + Greens',
            '120g Quinoa / Buckwheat',
            '150g Roasted Root Veggies',
            '130g Lentils + Spinach',
          ],
          [
            '140g Cartof Dulce + Verdețuri',
            '120g Quinoa / Hrișcă',
            '150g Legume la Cuptor',
            '130g Linte + Spanac',
          ],
        ),
      },
      {
        id: 'fat',
        options: opts(
          ['12g Olive Oil + Pumpkin Seeds', '1/2 Avocado', '15g Walnuts', '25g Feta + Olives'],
          ['12g Ulei Măsline + Semințe Dovleac', '1/2 Avocado', '15g Nuci', '25g Feta + Măsline'],
        ),
      },
    ],
  },
];

/** Returns the 3 daily meals (Morning, Lunch, Dinner) for the active goal (`balance` reuses `energy`). */
export function mealsForGoal(goal: NutritionGoal): readonly MealTemplate[] {
  const key = goal === 'balance' ? 'energy' : goal;
  return MEAL_TEMPLATES.filter((m) => m.goal === key);
}

/** Cycles an ingredient to its next nutritional analog (0 → 1 → 2 → 3 → 0). */
export function cycleIngredientSwap(
  state: FuelDayState,
  mealId: string,
  ingredientId: string,
): FuelDayState {
  const k = `${mealId}:${ingredientId}`;
  const current = state.swaps[k] ?? 0;
  const next = (current + 1) % 4;
  return {
    ...state,
    swaps: { ...state.swaps, [k]: next },
  };
}

/** Toggles whether today's meal slot was eaten. */
export function toggleMealEaten(state: FuelDayState, dayKey: string, slot: MealSlot): FuelDayState {
  const k = `${dayKey}:${slot}`;
  return {
    ...state,
    eaten: { ...state.eaten, [k]: !state.eaten[k] },
  };
}

/* ==========================================================================
   IDEA #10: ATOMIC HABITS 1% COMPOUND & IDENTITY ENGINE
   ========================================================================== */

export interface AtomicMetrics {
  /** Total votes cast for the user's identity (focus sessions + workouts + habit days + meals). */
  identityVotes: number;
  /** Active consecutive or 14-day active days. */
  activeDays14: number;
  /** 1.01^activeDays365 multiplier (1% better per active day). 1.00 when 0 active days. */
  compoundMultiplier: number;
  /** True when yesterday was missed so "Never Miss Twice" shield is armed today. */
  neverMissTwiceAlert: boolean;
  /** Honest 28-day activity intensity matrix (oldest → today, 0..3). */
  cadence28: readonly (0 | 1 | 2 | 3)[];
  /** Real percentage of active days over the last 28 days (0..100). */
  consistency28Pct: number;
}

export function computeAtomicMetrics(input: {
  history: Session[];
  workouts: WorkoutEntry[];
  habitsDoneToday: number;
  mealsEatenToday: number;
  twoMinDoneToday: boolean;
  now?: number;
}): AtomicMetrics {
  const now = input.now ?? Date.now();
  const dayMs = 86_400_000;
  const activeDayBuckets = new Set<number>();
  const scoreByDay = new Map<number, number>();

  const bump = (idx: number, weight: number) => {
    if (idx < 0 || idx >= 365) return;
    activeDayBuckets.add(idx);
    scoreByDay.set(idx, (scoreByDay.get(idx) ?? 0) + weight);
  };

  for (const s of input.history) {
    const idx = Math.floor((now - s.at) / dayMs);
    bump(idx, s.min >= 25 ? 2 : 1);
  }
  for (const w of input.workouts) {
    const idx = Math.floor((now - w.startedAt) / dayMs);
    bump(idx, 2);
  }
  const todayBonus =
    input.habitsDoneToday + input.mealsEatenToday + (input.twoMinDoneToday ? 1 : 0);
  if (todayBonus > 0) {
    bump(0, todayBonus);
  }

  let activeDays14 = 0;
  for (let i = 0; i < 14; i++) {
    if (activeDayBuckets.has(i)) activeDays14 += 1;
  }

  let activeDays28 = 0;
  const cadence28: (0 | 1 | 2 | 3)[] = [];
  for (let i = 27; i >= 0; i--) {
    const score = scoreByDay.get(i) ?? 0;
    if (score > 0) activeDays28 += 1;
    cadence28.push(score === 0 ? 0 : score === 1 ? 1 : score <= 3 ? 2 : 3);
  }
  const consistency28Pct = Math.round((activeDays28 / 28) * 100);

  const totalActive = activeDayBuckets.size;
  const compoundMultiplier =
    totalActive === 0 ? 1 : Number(Math.pow(1.01, Math.min(365, totalActive)).toFixed(2));
  const identityVotes =
    input.history.length +
    input.workouts.length * 2 +
    input.habitsDoneToday +
    input.mealsEatenToday +
    (input.twoMinDoneToday ? 1 : 0);

  const todayActive = activeDayBuckets.has(0);
  const yesterdayActive = activeDayBuckets.has(1);
  const neverMissTwiceAlert = !todayActive && !yesterdayActive && activeDays14 > 0;

  return {
    identityVotes,
    activeDays14,
    compoundMultiplier,
    neverMissTwiceAlert,
    cadence28,
    consistency28Pct,
  };
}

/* ==========================================================================
   IDEA #3 & #6 & #8: 48H MUSCLE RECOVERY + MIND×BODY CORRELATION + 5-AXIS RADAR
   ========================================================================== */

export interface MuscleRecoveryStatus {
  fresh: Muscle[];
  recovering: Muscle[];
  hot: Muscle[];
  recommendedPair: [Muscle, Muscle];
}

export interface MuscleRecoveryDetail {
  muscle: Muscle;
  /** Exact 0..100 recovery percentage (Fitbod exponential decay curve). */
  pct: number;
  /** Hours remaining until >= 95% recovered. */
  hoursToFull: number;
  status: 'fresh' | 'recovering' | 'fatigued';
}

export interface AdaptiveMacroBudget {
  baseKcal: number;
  targetKcal: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  workoutBonusKcal: number;
  workoutBonusProteinG: number;
  focusBonusCarbsG: number;
  trainedToday: boolean;
  deepFocusToday: boolean;
}

const CORE_MUSCLE_ORDER: readonly Muscle[] = [
  'chest',
  'shoulders',
  'lats',
  'quads',
  'abs',
  'biceps',
  'triceps',
  'glutes',
  'hamstrings',
  'calves',
];

/**
 * Fitbod-inspired Exponential Muscle Recovery Curve (0%..100%).
 * Evaluates all workouts in the last 96 hours, weights primary (1.0) vs secondary (0.5)
 * muscle sets and volume, and decays fatigue exponentially with half-life ~24h (lambda = 0.032/h).
 */
export function computeFitbodMuscleCurve(
  workouts: WorkoutEntry[],
  now: number = Date.now(),
): Record<Muscle, MuscleRecoveryDetail> {
  const windowMs = 96 * 3_600_000;
  const lambda = 0.032;
  const fatigueByMuscle: Partial<Record<Muscle, number>> = {};

  for (const w of workouts) {
    const dtMs = now - w.startedAt;
    if (dtMs < 0 || dtMs > windowMs) continue;
    const hoursAgo = dtMs / 3_600_000;
    const decay = Math.exp(-lambda * hoursAgo);

    if (w.sets.length === 0) {
      // Cardio or duration session taxes legs & core
      const baseStrain = Math.min(45, Math.max(12, (w.durationSec / 60) * 0.9));
      for (const cm of ['quads', 'hamstrings', 'calves', 'glutes', 'abs'] as const) {
        fatigueByMuscle[cm] = (fatigueByMuscle[cm] ?? 0) + baseStrain * decay * 0.65;
      }
    }

    for (const s of w.sets) {
      const ex = getExercise(s.ex);
      if (!ex) continue;
      const intensity =
        1 + Math.min(0.65, ((s.reps ?? 10) / 12) * 0.25 + ((s.kg ?? 0) > 0 ? 0.2 : 0));
      ex.muscles.forEach((m, idx) => {
        const roleFactor = idx === 0 ? 15 : 7.5;
        fatigueByMuscle[m] = (fatigueByMuscle[m] ?? 0) + roleFactor * intensity * decay;
      });
    }
  }

  const allMuscles: readonly Muscle[] = [
    ...CORE_MUSCLE_ORDER,
    'traps',
    'forearms',
    'obliques',
    'adductors',
    'lowerBack',
  ];
  const out = {} as Record<Muscle, MuscleRecoveryDetail>;
  for (const m of allMuscles) {
    const rawFatigue = Math.min(92, Math.round(fatigueByMuscle[m] ?? 0));
    const pct = Math.max(8, Math.min(100, 100 - rawFatigue));
    const hoursToFull =
      pct >= 92 ? 0 : Math.max(2, Math.min(72, Math.round(((95 - pct) / 90) * 48)));
    const status = pct >= 85 ? 'fresh' : pct >= 52 ? 'recovering' : 'fatigued';
    out[m] = { muscle: m, pct, hoursToFull, status };
  }
  return out;
}

/**
 * MacroFactor-inspired Adaptive Daily Energy & Macro Expenditure Budget.
 * Dynamically scales daily kcal, protein, and slow-carb targets based on today's
 * logged workouts and deep-focus cognitive load.
 */
export function computeMacroFactorBudget(input: {
  goal: NutritionGoal;
  focusMinToday: number;
  workouts: WorkoutEntry[];
  now?: number;
}): AdaptiveMacroBudget {
  const now = input.now ?? Date.now();
  const meals = mealsForGoal(input.goal);
  const base = meals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      p: acc.p + m.proteinG,
      c: acc.c + m.carbsG,
      f: acc.f + m.fatG,
    }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );

  const recent24h = input.workouts.filter(
    (w) => now - w.startedAt >= 0 && now - w.startedAt <= 24 * 3_600_000,
  );
  const trainedToday = recent24h.length > 0;
  const workoutBonusProteinG = trainedToday ? 22 : 0;
  const workoutBonusKcal = trainedToday ? 190 : 0;

  const deepFocusToday = input.focusMinToday >= 50;
  const focusBonusCarbsG = deepFocusToday ? 16 : 0;
  const focusBonusKcal = deepFocusToday ? 64 : 0;

  return {
    baseKcal: base.kcal,
    targetKcal: base.kcal + workoutBonusKcal + focusBonusKcal,
    targetProteinG: base.p + workoutBonusProteinG,
    targetCarbsG: base.c + focusBonusCarbsG,
    targetFatG: base.f,
    workoutBonusKcal,
    workoutBonusProteinG,
    focusBonusCarbsG,
    trainedToday,
    deepFocusToday,
  };
}

export function computeMuscleRecovery48h(
  levels7d: Partial<Record<Muscle, 0 | 1 | 2 | 3>>,
): MuscleRecoveryStatus {
  const fresh: Muscle[] = [];
  const recovering: Muscle[] = [];
  const hot: Muscle[] = [];

  for (const m of CORE_MUSCLE_ORDER) {
    const lv = levels7d[m] ?? 0;
    if (lv >= 3) hot.push(m);
    else if (lv >= 1) recovering.push(m);
    else fresh.push(m);
  }

  const pick1 = fresh[0] ?? recovering[0] ?? 'chest';
  const pick2 = fresh[1] ?? recovering[1] ?? (pick1 === 'chest' ? 'shoulders' : 'abs');
  return { fresh, recovering, hot, recommendedPair: [pick1, pick2] };
}

/** Idea #6: Computes Mind × Body synergy boost from real focus & workout logs. Returns null until enough data exists. */
export function computeMindBodySynergy(
  history: Session[],
  workouts: WorkoutEntry[],
): number | null {
  if (history.length === 0 || workouts.length === 0) return null;
  const dayKey = (ts: number) => Math.floor(ts / 86_400_000);
  const workoutDays = new Set(workouts.map((w) => dayKey(w.startedAt)));
  const focusByDay = new Map<number, number>();
  for (const s of history) {
    const k = dayKey(s.at);
    focusByDay.set(k, (focusByDay.get(k) ?? 0) + Math.max(0, s.min));
  }
  let trainSum = 0;
  let trainCount = 0;
  let restSum = 0;
  let restCount = 0;
  for (const [k, mins] of focusByDay) {
    if (workoutDays.has(k)) {
      trainSum += mins;
      trainCount += 1;
    } else {
      restSum += mins;
      restCount += 1;
    }
  }
  if (trainCount === 0 || restCount === 0) return null;
  const trainAvg = trainSum / trainCount;
  const restAvg = Math.max(15, restSum / restCount);
  const diff = Math.round(((trainAvg - restAvg) / restAvg) * 100);
  return Math.max(-50, Math.min(100, diff));
}

export interface Radar5Axes {
  /** 0..100 for [Focus, Execution, Body, Fuel, Habits] */
  current: readonly [number, number, number, number, number];
  baseline: readonly [number, number, number, number, number];
}

export function compute5AxisRadar(input: {
  mindPct: number;
  execPct: number;
  bodyPct: number;
  fuelPct: number;
  habitPct: number;
}): Radar5Axes {
  const c = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  const current: readonly [number, number, number, number, number] = [
    c(input.mindPct),
    c(input.execPct),
    c(input.bodyPct),
    c(input.fuelPct),
    c(input.habitPct),
  ];
  const baseline: readonly [number, number, number, number, number] = [
    current[0] > 0 ? Math.round(current[0] * 0.62) : 0,
    current[1] > 0 ? Math.round(current[1] * 0.58) : 0,
    current[2] > 0 ? Math.round(current[2] * 0.6) : 0,
    current[3] > 0 ? Math.round(current[3] * 0.55) : 0,
    current[4] > 0 ? Math.round(current[4] * 0.64) : 0,
  ];
  return { current, baseline };
}

/* ==========================================================================
   IDEA #5: 40HZ GAMMA BINAURAL FOCUS ENGINE (Pure Web Audio API, zero assets)
   ========================================================================== */

let audioCtx: AudioContext | null = null;
let leftOsc: OscillatorNode | null = null;
let rightOsc: OscillatorNode | null = null;
let gainNode: GainNode | null = null;

export function toggleGammaBinaural(enable?: boolean): boolean {
  if (typeof window === 'undefined') return false;
  const isRunning = leftOsc !== null;
  const target = enable ?? !isRunning;

  if (!target) {
    try {
      leftOsc?.stop();
      rightOsc?.stop();
      leftOsc?.disconnect();
      rightOsc?.disconnect();
      gainNode?.disconnect();
    } catch {
      /* ignore */
    }
    leftOsc = null;
    rightOsc = null;
    gainNode = null;
    return false;
  }

  if (isRunning) return true;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return false;
    audioCtx = audioCtx ?? new Ctx();
    if (audioCtx.state === 'suspended') void audioCtx.resume();

    // 200Hz Left + 240Hz Right = 40Hz Gamma Focus Binaural Beat at gentle volume
    const merger = audioCtx.createChannelMerger(2);
    gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.035;

    leftOsc = audioCtx.createOscillator();
    rightOsc = audioCtx.createOscillator();
    leftOsc.type = 'sine';
    rightOsc.type = 'sine';
    leftOsc.frequency.value = 200;
    rightOsc.frequency.value = 240;

    leftOsc.connect(merger, 0, 0);
    rightOsc.connect(merger, 0, 1);
    merger.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    leftOsc.start();
    rightOsc.start();
    return true;
  } catch {
    leftOsc = null;
    rightOsc = null;
    return false;
  }
}
